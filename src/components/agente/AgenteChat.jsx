import { useState, useRef, useEffect, useMemo } from 'react'
import { orderBy, limit } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { normalizarRef } from '../filtros/filtrosUtils'
import {
  statusGeradorLabel,
  statusMaterialLabel,
  statusOsLabel,
  statusEventoLabel,
  statusEfetivoCaminhao,
  tipoVeiculo,
  tipoVeiculoLabel,
  caminhaoKm,
  caminhaoSemKm,
  formatarData,
} from '../../utils/formatters'

const ATALHOS = [
  { label: 'Hoje', prompt: 'O que aconteceu na empresa hoje?' },
  { label: 'Filtros', prompt: 'Quais filtros estão com estoque baixo?' },
  { label: 'Geradores', prompt: 'Me dê um resumo do status dos geradores.' },
  { label: 'Manutenção', prompt: 'Quais manutenções estão em aberto?' },
  { label: 'Eventos', prompt: 'Quais eventos estão ativos e o que saiu para eles?' },
  { label: 'Veículos', prompt: 'Qual a situação da frota de veículos?' },
  { label: 'Estoque', prompt: 'O que preciso verificar no estoque hoje?' },
]

// Quais blocos de dados reais entram no prompt de cada perfil. Injetar dado que o
// perfil nem enxerga no sistema so gasta token e polui a resposta: o comprador nao
// precisa do status da frota nem dos eventos.
const TUDO = ['filtros', 'geradores', 'os', 'materiais', 'eventos', 'veiculos', 'movimentacoes']
const DADOS_POR_PERFIL = {
  admin: TUDO,
  gerente: TUDO,
  almoxarife: TUDO,
  franca: ['filtros', 'geradores', 'os', 'veiculos', 'eventos', 'movimentacoes'],
  compras: ['filtros', 'materiais', 'movimentacoes'],
}
const DADOS_PADRAO = ['filtros', 'geradores']

// Teto de itens listados por bloco. O resumo vai em TODA requisicao, entao ele
// precisa ser curto: contagens sempre, e so os criticos nomeados um a um.
const LIMITE_LISTA = 12

// Quantos registros de movimentacao trazer de cada colecao de historico. E um
// orderBy(criadoEm desc) + limit no proprio Firestore: sem isso, colecoes que so
// crescem (saidas, entradas, baixas) seriam lidas inteiras a cada abertura do chat.
const LIMITE_MOVIMENTO = 60
const RESTRICOES_MOVIMENTO = [orderBy('criadoEm', 'desc'), limit(LIMITE_MOVIMENTO)]

const UM_DIA = 24 * 60 * 60 * 1000

function listaLimitada(itens, limite = LIMITE_LISTA) {
  if (itens.length <= limite) return itens.join('; ')
  return `${itens.slice(0, limite).join('; ')}; ...e mais ${itens.length - limite}`
}

// dataAbertura pode ser Timestamp do Firestore ou string, dependendo de como a OS
// foi gravada. Devolve null quando nao da para interpretar.
function paraData(valor) {
  if (!valor) return null
  const d = valor?.toDate ? valor.toDate() : new Date(valor)
  return isNaN(d.getTime()) ? null : d
}

// Filtros de mesma referencia compartilham o MESMO estoque fisico (ver filtrosUtils),
// entao agrupamos por referencia para nao contar o mesmo item varias vezes.
function resumoFiltros(filtros) {
  const ativos = filtros.filter(f => f.ativo !== false)
  if (!ativos.length) return null

  const grupos = new Map()
  ativos.forEach(f => {
    const chave = normalizarRef(f.referencia) || `id:${f.id}`
    const g = grupos.get(chave) || { nome: f.nome || f.referencia || 'sem nome', potencias: [], qtd: 0, min: 0 }
    if (f.potenciaGG) g.potencias.push(f.potenciaGG)
    g.qtd = Math.max(g.qtd, f.quantidadeAtual || 0)
    g.min = Math.max(g.min, f.estoqueMin || 0)
    grupos.set(chave, g)
  })

  const itens = [...grupos.values()]
  const zerados = itens.filter(i => i.qtd <= 0)
  const baixos = itens.filter(i => i.qtd > 0 && i.qtd <= i.min)
  const descrever = i => `${i.nome} (${[...new Set(i.potencias)].join('/') || 'sem potência'}) — ${i.qtd} un, mínimo ${i.min}`

  const linhas = [`FILTROS: ${itens.length} itens distintos — ${zerados.length} zerados, ${baixos.length} abaixo do mínimo.`]
  if (zerados.length) linhas.push(`Zerados: ${listaLimitada(zerados.map(descrever))}`)
  if (baixos.length) linhas.push(`Abaixo do mínimo: ${listaLimitada(baixos.map(descrever))}`)
  return linhas.join('\n')
}

function resumoGeradores(geradores) {
  const ativos = geradores.filter(g => g.ativo !== false && g.status !== 'inativo')
  if (!ativos.length) return null

  const porStatus = {}
  ativos.forEach(g => {
    const label = statusGeradorLabel(g.status || 'disponivel')
    porStatus[label] = (porStatus[label] || 0) + 1
  })
  const contagem = Object.entries(porStatus).map(([label, n]) => `${label}: ${n}`).join('; ')
  const comDefeito = ativos.filter(g => g.temDefeito || g.status === 'defeito').map(g => g.codigo).filter(Boolean)

  const linhas = [`GERADORES: ${ativos.length} ativos — ${contagem}.`]
  if (comDefeito.length) linhas.push(`Com defeito: ${listaLimitada(comDefeito)}`)
  return linhas.join('\n')
}

// "Atrasada" segue a mesma regra da tela de Manutencao: aberta ha 2 dias ou mais.
function resumoOrdens(ordens) {
  if (!ordens.length) return null
  const agora = Date.now()
  const limiteAtrasada = 2 * 24 * 60 * 60 * 1000
  const abertas = ordens.filter(o => o.status === 'pendente' || o.status === 'em_andamento')
  const atrasadas = abertas.filter(o => {
    const d = paraData(o.dataAbertura)
    return d && (agora - d.getTime()) >= limiteAtrasada
  })

  const linhas = [`MANUTENÇÃO: ${abertas.length} OS em aberto — ${atrasadas.length} atrasadas (abertas há 2 dias ou mais).`]
  if (abertas.length) {
    const descrever = o => {
      const d = paraData(o.dataAbertura)
      const dias = d ? Math.floor((agora - d.getTime()) / 86400000) : null
      const idade = dias === null ? '' : `, aberta há ${dias}d`
      return `${o.numero || 'sem número'} ${o.equipamentoLabel || 'equipamento não informado'} (${statusOsLabel(o.status)}${idade})`
    }
    linhas.push(`Em aberto: ${listaLimitada(abertas.map(descrever))}`)
  }

  const seteDias = agora - 7 * UM_DIA
  const concluidasSemana = ordens.filter(o => {
    if (o.status !== 'concluida') return false
    const d = paraData(o.dataConclusao)
    return d && d.getTime() >= seteDias
  })
  if (concluidasSemana.length) {
    linhas.push(`Concluídas nos últimos 7 dias: ${listaLimitada(concluidasSemana.map(o => `${o.numero || 'sem número'} ${o.equipamentoLabel || ''}`.trim()))}`)
  }
  return linhas.join('\n')
}

function resumoMateriais(materiais) {
  if (!materiais.length) return null
  const porStatus = {}
  materiais.forEach(m => {
    const label = statusMaterialLabel(m.status || 'disponivel')
    porStatus[label] = (porStatus[label] || 0) + 1
  })
  const contagem = Object.entries(porStatus).map(([label, n]) => `${label}: ${n}`).join('; ')

  const linhas = [`ESTOQUE (materiais e cabos): ${materiais.length} itens — ${contagem}.`]
  const problema = materiais.filter(m => m.status === 'manutencao' || m.status === 'perdido')
  if (problema.length) {
    linhas.push(`Em manutenção ou perdidos: ${listaLimitada(problema.map(m => `${m.nome || 'sem nome'}${m.codigo ? ` (${m.codigo})` : ''} — ${statusMaterialLabel(m.status)}`))}`)
  }
  return linhas.join('\n')
}

function resumoEventos(eventos) {
  if (!eventos.length) return null
  const porStatus = {}
  eventos.forEach(e => {
    const label = statusEventoLabel(e.status || 'ativo')
    porStatus[label] = (porStatus[label] || 0) + 1
  })
  const contagem = Object.entries(porStatus).map(([label, n]) => `${label}: ${n}`).join('; ')

  const emAndamento = eventos.filter(e => e.status === 'ativo' || e.status === 'agendado')
  const linhas = [`EVENTOS: ${eventos.length} no total — ${contagem}.`]
  if (emAndamento.length) {
    const descrever = e => `${e.nome || 'sem nome'}${e.local ? ` em ${e.local}` : ''}${e.data ? ` (${formatarData(e.data)})` : ''} — ${statusEventoLabel(e.status)}`
    linhas.push(`Ativos/agendados: ${listaLimitada(emAndamento.map(descrever))}`)
  }
  return linhas.join('\n')
}

// Veiculo com gerador montado acompanha o status do gerador quando ele vai a evento
// ou locacao — por isso o status vem de statusEfetivoCaminhao, e nao do campo cru.
function resumoVeiculos(caminhoes, geradores) {
  const ativos = caminhoes.filter(c => c.ativo !== false && c.status !== 'inativo')
  if (!ativos.length) return null

  const porId = new Map((geradores || []).map(g => [g.id, g]))
  const porStatus = {}
  const descricoes = []
  ativos.forEach(c => {
    const montado = c.geradorMontadoId ? porId.get(c.geradorMontadoId) : null
    const label = statusGeradorLabel(statusEfetivoCaminhao(c, montado))
    porStatus[label] = (porStatus[label] || 0) + 1

    const km = caminhaoSemKm(c) ? 'sem hodômetro' : (caminhaoKm(c) != null ? `${caminhaoKm(c)} km` : 'km não informado')
    const comGG = c.geradorMontadoCodigo ? `, com ${c.geradorMontadoCodigo} montado` : ''
    const modelo = [c.marca, c.modelo].filter(Boolean).join(' ')
    descricoes.push(`${c.placa || 'sem placa'}${modelo ? ` ${modelo}` : ''} (${tipoVeiculoLabel(tipoVeiculo(c))}, ${label}, ${km}${comGG})`)
  })
  const contagem = Object.entries(porStatus).map(([label, n]) => `${label}: ${n}`).join('; ')

  return [
    `VEÍCULOS: ${ativos.length} ativos — ${contagem}.`,
    `Frota: ${listaLimitada(descricoes)}`,
  ].join('\n')
}

function inicioDoDia() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Bloco padrao de historico: conta o que foi lancado hoje e nos ultimos 7 dias, e
// lista item a item o de hoje — que e o que costumam perguntar ("o que entrou hoje?").
// Sem lancamento hoje, lista o da semana para a resposta nao ficar vazia.
function resumoMovimento(titulo, registros, descrever) {
  if (!registros.length) return null
  const hoje0 = inicioDoDia()
  const seteDias = Date.now() - 7 * UM_DIA

  const comData = registros
    .map(r => ({ registro: r, quando: paraData(r.criadoEm)?.getTime() ?? null }))
    .filter(x => x.quando !== null)
  const hoje = comData.filter(x => x.quando >= hoje0)
  const semana = comData.filter(x => x.quando >= seteDias)

  // O "+" avisa que a contagem bateu no teto da consulta e pode haver mais.
  const totalSemana = `${semana.length}${registros.length >= LIMITE_MOVIMENTO && semana.length === registros.length ? '+' : ''}`
  const linhas = [`${titulo}: ${hoje.length} hoje, ${totalSemana} nos últimos 7 dias.`]
  if (hoje.length) linhas.push(`Hoje: ${listaLimitada(hoje.map(x => descrever(x.registro)))}`)
  else if (semana.length) linhas.push(`Últimos 7 dias: ${listaLimitada(semana.map(x => descrever(x.registro)))}`)
  return linhas.join('\n')
}

function resumoMovimentacoes({ entradas, baixas, saidas, devolucoes, transferencias }) {
  const blocos = [
    resumoMovimento('ENTRADAS DE FILTRO', entradas, e =>
      `${e.filtroNome || 'filtro'} +${e.quantidade || 0}${e.fornecedor ? ` (${e.fornecedor})` : ''}${e.nf ? ` NF ${e.nf}` : ''}${e.operadorNome ? ` por ${e.operadorNome}` : ''}`),
    resumoMovimento('BAIXAS DE FILTRO', baixas, b =>
      `${b.filtroNome || 'filtro'} -${b.quantidade || 0}${b.motivo ? ` (${b.motivo})` : ''}${b.retiradoPor ? ` para ${b.retiradoPor}` : ''}`),
    resumoMovimento('SAÍDAS DE MATERIAL', saidas, s =>
      `${s.numeroFormatado || 'sem número'} — ${s.eventoNome || 'sem evento'} — ${s.itens?.length || 0} itens${s.geradorCodigo ? `, ${s.geradorCodigo}` : ''}${s.responsavelNome ? `, recebeu ${s.responsavelNome}` : ''} (${s.status || 'ativo'})`),
    resumoMovimento('DEVOLUÇÕES', devolucoes, d =>
      `${d.eventoNome || 'sem evento'} — ${d.itens?.length || 0} itens${d.operadorNome ? ` por ${d.operadorNome}` : ''}`),
    resumoMovimento('TRANSFERÊNCIAS ENTRE EVENTOS', transferencias, t =>
      `${t.eventoOrigemNome || 'origem?'} → ${t.eventoDestinoNome || 'destino?'} — ${t.itens?.length || 0} itens${t.motivo ? ` (${t.motivo})` : ''}`),
  ]
  return blocos.filter(Boolean).join('\n\n') || null
}

function systemPrompt(perfil, nomeUsuario, resumoDados) {
  const focos = {
    admin: 'Você tem acesso a tudo: materiais, filtros, geradores, manutenção, compras.',
    gerente: 'Seu foco é patrimônio, relatórios e visão geral da frota.',
    almoxarife: 'Seu foco é cabos, estoque, organização e saída de material.',
    franca: 'Seu foco é filtros, geradores e procedimentos de manutenção. Linguagem simples e direta.',
    compras: 'Seu foco é demanda, fornecedores e histórico de preços.',
  }
  return `Você é o Agente IA da SOS Energia, assistente operacional especializado no almoxarifado e frota de geradores da empresa.

Usuário: ${nomeUsuario} — Perfil: ${perfil}
${focos[perfil] || ''}

Regras:
- Responda APENAS sobre assuntos da SOS Energia (materiais, cabos, filtros, geradores, veículos, eventos, manutenção, estoque, compras)
- Respostas curtas: até 3 parágrafos. Quando pedirem um panorama ("o que aconteceu hoje", "como está a empresa"), pode responder em lista de no máximo 8 linhas
- Linguagem simples, direta, sem jargão desnecessário
- Se não souber, diga "Não tenho essa informação ainda" e explique o que precisa ser alimentado

Base da empresa:
- Frota de ~107 geradores (GG-001 a GG-107), além de caminhões, carros e empilhadeiras
- Cabos de 4x6 a 4x50mm² e demais materiais de almoxarifado
- Filtros organizados por potência de GG: 30, 40, 60, 75, 100, 125, 150, 180, 200, 250, 300, 350, 400, 500, 700 e 750 kVA, mais as linhas Caminhão e Empilhadeira. Filtros de mesma referência compartilham o mesmo estoque físico — dar baixa em um baixa em todos
- Status de gerador: Disponível, Em Evento, Em Locação, Em Manutenção, Com Defeito, Inativo
- Veículos têm módulo próprio (aba "Veículos"), que cobre caminhões E carros, identificados por placa, com modelo e km rodado. Um veículo pode ter um gerador montado em cima; quando esse gerador vai para evento ou locação, o veículo acompanha o status dele
- Manutenção trabalha com ordens de serviço numeradas OS-AAAA-NNN, abertas em 2 passos (equipamento e local — pátio ou locação — e depois os filtros usados, que já dão baixa no estoque). Na conclusão entram relatório do serviço, fotos e assinaturas
- Módulos do sistema: Dashboard, Saída de Material (5 passos, com evento, romaneio e assinatura), Eventos, Devolução, Transferência, Estoque, Filtros, Geradores (patrimônio), Veículos, Manutenção, Relatórios e Compras/Solicitações${resumoDados ? `

DADOS REAIS DO SISTEMA AGORA (${new Date().toLocaleString('pt-BR')}):
${resumoDados}

Use esses números ao responder — eles são a situação atual, não estimativa. Cite códigos,
placas, números de OS/OM e quantidades quando ajudar. Os blocos de histórico (entradas e
baixas de filtro, saídas, devoluções) trazem os lançamentos mais recentes: o que está como
"hoje" foi lançado hoje mesmo. Se a pergunta pedir um dado que não está aí em cima — por
exemplo um período mais antigo do que o listado — diga que não tem essa informação e indique
em qual módulo do sistema ela está, em vez de inventar.` : ''}`
}

export default function AgenteChat({ compact = false }) {
  const { tipoPerfil, nome } = useAuth()
  const [mensagens, setMensagens] = useState([
    { role: 'assistant', content: `Olá, ${nome?.split(' ')[0] || ''}! Como posso ajudar?` }
  ])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  // Dados reais para o agente responder com a situacao de hoje, e nao so com o texto
  // fixo do prompt. Este componente so e montado com o chat aberto (drawer) ou na
  // pagina /agente, entao os listeners nao ficam ligados o tempo todo em toda tela.
  const { dados: filtros, carregando: carregandoFiltros, erro: erroFiltros } = useCollection('filtros')
  const { dados: geradores, carregando: carregandoGeradores, erro: erroGeradores } = useCollection('geradores')
  const { dados: ordens, carregando: carregandoOrdens, erro: erroOrdens } = useCollection('ordens_servico')
  const { dados: materiais, carregando: carregandoMateriais, erro: erroMateriais } = useCollection('materiais')
  const { dados: eventos, carregando: carregandoEventos, erro: erroEventos } = useCollection('eventos')
  const { dados: veiculos, carregando: carregandoVeiculos, erro: erroVeiculos } = useCollection('caminhoes')

  // Historico: so os ultimos registros de cada coleção, ja limitado na consulta.
  const { dados: entradas, carregando: carregandoEntradas, erro: erroEntradas } = useCollection('entradas_filtro', RESTRICOES_MOVIMENTO, 'agente-recentes')
  const { dados: baixas, carregando: carregandoBaixas, erro: erroBaixas } = useCollection('baixas_filtro', RESTRICOES_MOVIMENTO, 'agente-recentes')
  const { dados: saidas, carregando: carregandoSaidas, erro: erroSaidas } = useCollection('ordens_saida', RESTRICOES_MOVIMENTO, 'agente-recentes')
  const { dados: devolucoes, carregando: carregandoDevolucoes, erro: erroDevolucoes } = useCollection('devolucoes', RESTRICOES_MOVIMENTO, 'agente-recentes')
  const { dados: transferencias, carregando: carregandoTransf, erro: erroTransf } = useCollection('transferencias', RESTRICOES_MOVIMENTO, 'agente-recentes')

  // Resumo compacto injetado no system prompt. Colecao ainda carregando (ou que falhou
  // ao ler) fica de fora — o agente continua respondendo, so sem aquele bloco de dados.
  // Melhor nao ter o dado do que afirmar "0 em aberto" por causa de uma leitura falha.
  const resumoDados = useMemo(() => {
    const permitidos = DADOS_POR_PERFIL[tipoPerfil] || DADOS_PADRAO
    const pronto = (bloco, carregandoCol, erroCol) => permitidos.includes(bloco) && !carregandoCol && !erroCol
    const blocos = []
    if (pronto('filtros', carregandoFiltros, erroFiltros)) blocos.push(resumoFiltros(filtros))
    if (pronto('geradores', carregandoGeradores, erroGeradores)) blocos.push(resumoGeradores(geradores))
    if (pronto('veiculos', carregandoVeiculos, erroVeiculos)) blocos.push(resumoVeiculos(veiculos, geradores))
    if (pronto('os', carregandoOrdens, erroOrdens)) blocos.push(resumoOrdens(ordens))
    if (pronto('eventos', carregandoEventos, erroEventos)) blocos.push(resumoEventos(eventos))
    if (pronto('materiais', carregandoMateriais, erroMateriais)) blocos.push(resumoMateriais(materiais))
    if (permitidos.includes('movimentacoes')) {
      blocos.push(resumoMovimentacoes({
        entradas: carregandoEntradas || erroEntradas ? [] : entradas,
        baixas: carregandoBaixas || erroBaixas ? [] : baixas,
        saidas: carregandoSaidas || erroSaidas ? [] : saidas,
        devolucoes: carregandoDevolucoes || erroDevolucoes ? [] : devolucoes,
        transferencias: carregandoTransf || erroTransf ? [] : transferencias,
      }))
    }
    return blocos.filter(Boolean).join('\n\n') || null
  }, [
    tipoPerfil,
    filtros, carregandoFiltros, erroFiltros,
    geradores, carregandoGeradores, erroGeradores,
    ordens, carregandoOrdens, erroOrdens,
    materiais, carregandoMateriais, erroMateriais,
    eventos, carregandoEventos, erroEventos,
    veiculos, carregandoVeiculos, erroVeiculos,
    entradas, carregandoEntradas, erroEntradas,
    baixas, carregandoBaixas, erroBaixas,
    saidas, carregandoSaidas, erroSaidas,
    devolucoes, carregandoDevolucoes, erroDevolucoes,
    transferencias, carregandoTransf, erroTransf,
  ])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar(texto) {
    const msg = texto || input.trim()
    if (!msg || carregando) return
    setInput('')
    setMensagens(prev => [...prev, { role: 'user', content: msg }])
    setCarregando(true)

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Agente IA não configurado. Adicione VITE_ANTHROPIC_API_KEY no arquivo .env para ativar.' }])
      setCarregando(false)
      return
    }

    try {
      const historico = [...mensagens, { role: 'user', content: msg }]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: systemPrompt(tipoPerfil, nome, resumoDados),
          messages: historico,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`${res.status}: ${errBody?.error?.message || res.statusText}`)
      }
      const data = await res.json()
      const resposta = data.content?.[0]?.text || 'Sem resposta.'
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
    } catch (e) {
      setMensagens(prev => [...prev, { role: 'assistant', content: `Erro ao conectar com o Agente: ${e.message}` }])
    } finally {
      setCarregando(false)
    }
  }

  function toggleVoz() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Reconhecimento de voz não suportado neste navegador.'); return }

    if (ouvindo) {
      recognitionRef.current?.stop()
      setOuvindo(false)
      return
    }

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.interimResults = false
    rec.onresult = (e) => {
      const texto = e.results[0][0].transcript
      setInput(texto)
      setOuvindo(false)
    }
    rec.onerror = () => setOuvindo(false)
    rec.onend = () => setOuvindo(false)
    recognitionRef.current = rec
    rec.start()
    setOuvindo(true)
  }

  function explicarMaisSimples(content) {
    enviar(`Explica de forma mais simples: "${content.slice(0, 100)}"`)
  }

  function feedback(idx, tipo) {
    setMensagens(prev => prev.map((m, i) => i === idx ? { ...m, feedback: tipo } : m))
  }

  return (
    <div style={compact ? { display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 } : undefined}
      className={compact ? '' : 'flex flex-col h-[calc(100vh-180px)]'}>
      {!compact && (
        <div className="flex gap-2 flex-wrap mb-3">
          {ATALHOS.map(a => (
            <button key={a.label} onClick={() => enviar(a.prompt)}
              className="px-3 py-1.5 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full hover:bg-brand-red hover:text-white transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }} className="space-y-3 pr-1 pb-2">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-brand-red text-white' : 'bg-white border border-gray-100 text-brand-black'} rounded-2xl px-4 py-3 text-sm shadow-sm`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.role === 'assistant' && i > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                  <button onClick={() => explicarMaisSimples(m.content)} className="text-xs text-gray-400 hover:text-brand-red transition-colors">
                    Me explica mais simples
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => feedback(i, 'positivo')} className={`text-sm transition-colors ${m.feedback === 'positivo' ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}>👍</button>
                    <button onClick={() => feedback(i, 'negativo')} className={`text-sm transition-colors ${m.feedback === 'negativo' ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>👎</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {carregando && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {compact && (
        <div className="flex-shrink-0 flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {ATALHOS.map(a => (
            <button key={a.label} onClick={() => enviar(a.prompt)}
              className="flex-shrink-0 px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full hover:bg-brand-red hover:text-white transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-shrink-0 flex gap-2 mt-3">
        <button onClick={toggleVoz}
          className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${ouvindo ? 'bg-brand-red text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
          placeholder="Pergunte algo sobre filtros, geradores, cabos..."
          className="input flex-1"
          disabled={carregando}
        />
        <button onClick={() => enviar()} disabled={!input.trim() || carregando}
          className="w-10 h-10 flex-shrink-0 bg-brand-red text-white rounded-full flex items-center justify-center hover:bg-brand-red-dark transition-colors disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
