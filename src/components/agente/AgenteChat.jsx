import { useState, useRef, useEffect, useMemo } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { comprimirParaDataUrl } from '../../utils/imagem'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { normalizarRef } from '../filtros/filtrosUtils'
import {
  statusGeradorLabel,
  statusMaterialLabel,
  statusOsLabel,
  statusEventoLabel,
  formatarDataHora,
  statusEfetivoCaminhao,
  tipoVeiculo,
  tipoVeiculoLabel,
  caminhaoKm,
  caminhaoSemKm,
  formatarData,
} from '../../utils/formatters'

const ATALHOS = [
  { label: 'Hoje', prompt: 'O que aconteceu na empresa hoje?' },
  { label: 'Compras', prompt: 'Quais solicitações de compra estão em aberto?' },
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
// Atencao: 'compras' aqui tem que respeitar a regra do Firestore, que so libera
// solicitacoes_compra para admin, gerente, almoxarife e compras — o mecanico nao le.
const TUDO = ['filtros', 'geradores', 'os', 'materiais', 'eventos', 'veiculos', 'movimentacoes', 'compras']
const DADOS_POR_PERFIL = {
  admin: TUDO,
  gerente: TUDO,
  almoxarife: TUDO,
  franca: ['filtros', 'geradores', 'os', 'veiculos', 'eventos', 'movimentacoes'],
  compras: ['filtros', 'materiais', 'movimentacoes', 'compras'],
}
const DADOS_PADRAO = ['filtros', 'geradores']

// Anexos aceitos. A foto passa pelo comprimirParaDataUrl (mesmo utilitario das
// fotos de OS), entao chega na API bem menor que o arquivo do celular. PDF vai
// como esta, por isso o teto proprio.
const PDF_MAX_BYTES = 4 * 1024 * 1024

// Quantas mensagens do historico ficam gravadas por conversa. O documento do
// Firestore tem limite de 1 MB — por isso o anexo NAO e gravado, so o nome dele.
const MAX_MENSAGENS_SALVAS = 60

function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = String(reader.result || '')
      const virgula = resultado.indexOf(',')
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado)
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

// Monta o conteudo de uma mensagem no formato da API: com anexo vira lista de
// blocos (imagem/documento + texto); sem anexo continua string simples.
function conteudoParaApi(m) {
  // Conversa recuperada do historico guarda so o nome do anexo, nao os bytes —
  // por isso o texto de reposicao, para nao mandar conteudo vazio para a API.
  if (!m.anexo?.dados) return m.content || `[${m.anexoNome || 'arquivo'} enviado antes]`
  const bloco = m.anexo.tipo === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m.anexo.dados } }
    : { type: 'image', source: { type: 'base64', media_type: m.anexo.mediaType || 'image/jpeg', data: m.anexo.dados } }
  return [bloco, { type: 'text', text: m.content || 'Analise este arquivo.' }]
}

// Versao da mensagem que vai para o Firestore: sem base64, so a referencia do
// anexo, para o documento nao estourar 1 MB.
function mensagemParaFirestore(m) {
  return {
    role: m.role,
    content: m.content || '',
    ...(m.anexo ? { anexoNome: m.anexo.nome || 'arquivo', anexoTipo: m.anexo.tipo } : {}),
    ...(m.feedback ? { feedback: m.feedback } : {}),
  }
}

function tituloDaConversa(mensagens) {
  const primeira = mensagens.find(m => m.role === 'user')?.content || 'Conversa'
  return primeira.length > 60 ? `${primeira.slice(0, 60)}...` : primeira
}

const STATUS_SOLICITACAO = {
  pendente: 'Pendente',
  em_cotacao: 'Em Cotação',
  comprado: 'Comprado',
  entregue: 'Entregue',
}

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

function limitar(texto, max) {
  const t = (texto || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}...` : t
}

// Ficha completa de OS. O resumo geral so cabe numero e status; quando a pergunta
// cita uma OS ou um equipamento, vale mandar a ficha inteira — servico realizado,
// problemas e filtros usados COM a referencia (que nao fica gravada na OS, vem da
// colecao filtros pelo filtroId). Sem citar nada, manda as 2 ultimas concluidas,
// que e o que costumam perguntar ("o que foi feito na ultima manutencao").
const LIMITE_OS_DETALHADA = 3

function detalharOrdens(ordens, filtros, pergunta) {
  if (!ordens.length) return null

  const texto = (pergunta || '').toUpperCase()
  const codigos = [...texto.matchAll(/\b(?:OS-\d{4}-\d+|GG-\d+)\b/g)].map(m => m[0])

  const escolhidas = codigos.length
    ? ordens.filter(o => codigos.some(c =>
        (o.numero || '').toUpperCase().includes(c) || (o.equipamentoLabel || '').toUpperCase().includes(c)
      ))
    : ordens
        .filter(o => o.status === 'concluida')
        .sort((a, b) => (paraData(b.dataConclusao)?.getTime() || 0) - (paraData(a.dataConclusao)?.getTime() || 0))
        .slice(0, 2)
  if (!escolhidas.length) return null

  const referenciaPorId = new Map(filtros.map(f => [f.id, f.referencia]))
  const fichas = escolhidas.slice(0, LIMITE_OS_DETALHADA).map(o => {
    const porQuem = o.concluidoPorNome ? ` por ${o.concluidoPorNome}` : ''
    const situacao = o.status === 'concluida'
      ? `Concluída${o.dataConclusao ? ` em ${formatarData(o.dataConclusao)}` : ''}${porQuem}`
      : `${statusOsLabel(o.status)}${o.dataAbertura ? `, aberta em ${formatarData(o.dataAbertura)}` : ''}`
    const linhas = [`${o.numero || 'sem número'} — ${o.equipamentoLabel || 'equipamento não informado'} (${situacao})`]

    const cabecalho = [
      o.tipo && `tipo ${o.tipo}`,
      o.mecanico && `mecânico ${o.mecanico}`,
      o.localTipo && `local ${o.localTipo}`,
      o.clienteNome && `cliente ${o.clienteNome}`,
      o.horimetroConclusao && `horímetro ${o.horimetroConclusao}`,
    ].filter(Boolean).join('; ')
    if (cabecalho) linhas.push(cabecalho)

    if (o.descricao) linhas.push(`Abertura: ${limitar(o.descricao, 200)}`)
    if (o.relatorioServico) linhas.push(`Serviço realizado: ${limitar(o.relatorioServico, 400)}`)
    if (o.problemasEncontrados) linhas.push(`Problemas encontrados: ${limitar(o.problemasEncontrados, 200)}`)

    const usados = (o.filtrosUsados || []).map(f => {
      const ref = referenciaPorId.get(f.filtroId || f.id)
      const qtd = f.quantidade ?? f.qtdUsada ?? 1
      // Quantidade na FRENTE de proposito: varias referencias terminam com "2 pças",
      // e com o "x2" no fim o modelo confundia a referencia com a quantidade usada.
      return `${qtd}x ${f.filtroNome || f.nome || 'filtro'}${ref ? ` (ref ${ref})` : ''}${f.potenciaGG ? ` — ${f.potenciaGG}` : ''}`
    })
    if (usados.length) linhas.push(`Filtros usados: ${listaLimitada(usados)}`)
    if (o.proximaPreventiva) linhas.push(`Próxima preventiva: ${formatarData(o.proximaPreventiva)}`)

    return linhas.join('\n')
  })

  const titulo = codigos.length ? 'FICHA DAS OS CITADAS NA PERGUNTA' : 'FICHA DAS ÚLTIMAS OS CONCLUÍDAS'
  return `${titulo}:\n\n${fichas.join('\n\n')}`
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

function resumoCompras(solicitacoes) {
  if (!solicitacoes.length) return null
  const abertas = solicitacoes.filter(s => s.status !== 'entregue')

  const porStatus = {}
  abertas.forEach(s => {
    const label = STATUS_SOLICITACAO[s.status] || s.status || 'sem status'
    porStatus[label] = (porStatus[label] || 0) + 1
  })
  const contagem = Object.entries(porStatus).map(([label, n]) => `${label}: ${n}`).join('; ')

  const linhas = [`COMPRAS: ${abertas.length} solicitações em aberto${contagem ? ` — ${contagem}` : ''}.`]
  if (abertas.length) {
    // urgentes primeiro: sao as que interessam quando a lista e cortada pelo limite
    const ordenadas = [...abertas].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0))
    const descrever = s => `${s.numero || 'sem número'} ${s.itemNome || 'item'} x${s.quantidadeSugerida || 0}${s.fornecedor ? ` (${s.fornecedor})` : ''} — ${STATUS_SOLICITACAO[s.status] || s.status}${s.urgente ? ', URGENTE' : ''}${s.solicitanteNome ? `, pedido por ${s.solicitanteNome}` : ''}`
    linhas.push(`Em aberto: ${listaLimitada(ordenadas.map(descrever))}`)
  }

  const seteDias = Date.now() - 7 * UM_DIA
  const entreguesSemana = solicitacoes.filter(s => {
    if (s.status !== 'entregue') return false
    const d = paraData(s.atualizadoEm)
    return d && d.getTime() >= seteDias
  })
  if (entreguesSemana.length) linhas.push(`Entregues nos últimos 7 dias: ${entreguesSemana.length}`)
  if (solicitacoes.length >= LIMITE_MOVIMENTO) {
    linhas.push(`(considerando apenas as ${LIMITE_MOVIMENTO} solicitações mais recentes)`)
  }
  return linhas.join('\n')
}

// solicitacoes_compra e a unica colecao do resumo que a regra do Firestore restringe
// por perfil. Como o useCollection assina assim que monta, aqui vai uma versao que so
// assina quando o perfil pode ler — senao o chat do mecanico dispararia
// permission-denied toda vez que fosse aberto.
// `restricoes` precisa ser uma constante de modulo (referencia estavel), senao cada
// render remonta o listener.
function useColecaoQuandoPermitido(colecao, permitido, restricoes) {
  const [estado, setEstado] = useState({ dados: [], carregando: permitido, erro: null })

  useEffect(() => {
    if (!permitido) return
    const ref = collection(db, colecao)
    const q = restricoes.length ? query(ref, ...restricoes) : query(ref)
    return onSnapshot(
      q,
      snap => setEstado({ dados: snap.docs.map(d => ({ id: d.id, ...d.data() })), carregando: false, erro: null }),
      err => {
        console.error('AgenteChat useColecaoQuandoPermitido:', err)
        setEstado({ dados: [], carregando: false, erro: err.message })
      }
    )
  }, [colecao, permitido, restricoes])

  return estado
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
- Linguagem simples, direta, sem jargão desnecessário
- Se não souber, diga "Não tenho essa informação ainda" e explique o que precisa ser alimentado

COMO ESCREVER A RESPOSTA (siga sempre):
- Comece com UMA frase que já responde a pergunta. Nada de preâmbulo ("Claro!", "Vamos lá", "Segue o resumo")
- Depois dessa frase, deixe uma linha em branco e detalhe. Blocos curtos, separados por linha em branco — nunca um parágrafo comprido
- Use lista com "- " quando forem itens soltos (filtros, geradores, OS). No máximo 6 itens, um por linha, cada um curto e completo em si
- Use título com "## " somente quando a resposta tiver 2 ou mais assuntos diferentes. Título curto, sem dois pontos no fim
- Use **negrito** só em número, código ou nome que o leitor precisa achar de relance (ex: **GG-042**, **7 zeradas**). Nunca em frase inteira
- Termine com a recomendação prática, em uma frase, quando houver o que fazer
- NÃO use tabela, emoji, itálico, bloco de código, nem despedida ("qualquer dúvida", "espero ter ajudado")
- Resposta curta: no total, no máximo 12 linhas

Base da empresa:
- Frota de ~107 geradores (GG-001 a GG-107), além de caminhões, carros e empilhadeiras
- Cabos de 4x6 a 4x50mm² e demais materiais de almoxarifado
- Filtros organizados por potência de GG: 30, 40, 60, 75, 100, 125, 150, 180, 200, 250, 300, 350, 400, 500, 700 e 750 kVA, mais as linhas Caminhão e Empilhadeira. Filtros de mesma referência compartilham o mesmo estoque físico — dar baixa em um baixa em todos
- Status de gerador: Disponível, Em Evento, Em Locação, Em Manutenção, Com Defeito, Inativo
- Veículos têm módulo próprio (aba "Veículos"), que cobre caminhões E carros, identificados por placa, com modelo e km rodado. Um veículo pode ter um gerador montado em cima; quando esse gerador vai para evento ou locação, o veículo acompanha o status dele
- Manutenção trabalha com ordens de serviço numeradas OS-AAAA-NNN, abertas em 2 passos (equipamento e local — pátio ou locação — e depois os filtros usados, que já dão baixa no estoque). Na conclusão entram relatório do serviço, fotos e assinaturas
- O relatório oficial da OS em PDF sai na própria tela da ordem de serviço (Manutenção, abrir a OS, botão de imprimir). Você não gera PDF: você resume e responde sobre o conteúdo, e indica essa tela quando pedirem o documento
- Módulos do sistema: Dashboard, Saída de Material (5 passos, com evento, romaneio e assinatura), Eventos, Devolução, Transferência, Estoque, Filtros, Geradores (patrimônio), Veículos, Manutenção, Relatórios e Compras/Solicitações${resumoDados ? `

DADOS REAIS DO SISTEMA AGORA (${new Date().toLocaleString('pt-BR')}):
${resumoDados}

Use esses números ao responder — eles são a situação atual, não estimativa. Cite códigos,
placas, números de OS/OM e quantidades quando ajudar. Quando a pergunta for sobre um serviço
de manutenção, use a FICHA DAS OS: diga o que foi feito, os filtros usados com a referência,
quem executou e a próxima preventiva — nessa ordem. Os blocos de histórico (entradas e
baixas de filtro, saídas, devoluções) trazem os lançamentos mais recentes: o que está como
"hoje" foi lançado hoje mesmo. Se a pergunta pedir um dado que não está aí em cima — por
exemplo um período mais antigo do que o listado — diga que não tem essa informação e indique
em qual módulo do sistema ela está, em vez de inventar.` : ''}`
}

// O balao mostrava texto puro, entao o markdown do modelo aparecia como asterisco
// na tela. Estes dois formatadores cobrem exatamente o que o agente usa — titulo,
// negrito e lista — e montam elementos React (nada de HTML cru, sem risco de
// injecao). Cores vem das classes utilitarias do projeto, que o dark mode ja cobre.
function comNegrito(texto, chave) {
  return texto.split(/(\*\*.+?\*\*)/g).filter(Boolean).map((parte, i) => (
    parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={`${chave}-${i}`} className="font-semibold">{parte.slice(2, -2)}</strong>
      // Rede de seguranca: um ** sem par (ex: "***" ou negrito aberto e nao fechado)
      // nunca chega na tela como asterisco.
      : <span key={`${chave}-${i}`}>{parte.replace(/\*\*/g, '')}</span>
  ))
}

function MensagemFormatada({ texto }) {
  const blocos = []
  let lista = []

  const fecharLista = () => {
    if (!lista.length) return
    blocos.push(
      <ul key={`ul-${blocos.length}`} className="my-2 space-y-1.5">
        {lista.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="opacity-40 select-none flex-shrink-0">{item.marca}</span>
            <span className="flex-1 leading-relaxed">{comNegrito(item.texto, `li-${i}`)}</span>
          </li>
        ))}
      </ul>
    )
    lista = []
  }

  ;(texto || '').split('\n').forEach((linhaCrua, i) => {
    const linha = linhaCrua.trim()
    const item = linha.match(/^(?:[-*•]|(\d+)[.)])\s+(.*)$/)
    if (item) {
      lista.push({ marca: item[1] ? `${item[1]}.` : '•', texto: item[2] })
      return
    }
    fecharLista()
    if (!linha) return
    const titulo = linha.match(/^#{1,4}\s+(.*)$/)
    blocos.push(
      titulo
        ? <p key={i} className="font-semibold mt-3 first:mt-0 mb-1">{comNegrito(titulo[1], `h-${i}`)}</p>
        : <p key={i} className="leading-relaxed my-1.5 first:mt-0 last:mb-0">{comNegrito(linha, `p-${i}`)}</p>
    )
  })
  fecharLista()

  return <div>{blocos}</div>
}

function saudacao(nome) {
  return { role: 'assistant', content: `Olá, ${nome?.split(' ')[0] || ''}! Como posso ajudar?` }
}

export default function AgenteChat({ compact = false }) {
  const { tipoPerfil, nome, uid } = useAuth()
  const permitidos = DADOS_POR_PERFIL[tipoPerfil] || DADOS_PADRAO
  const [mensagens, setMensagens] = useState([saudacao(nome)])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [anexo, setAnexo] = useState(null)
  const [erroAnexo, setErroAnexo] = useState('')
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [conversas, setConversas] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)
  const arquivoRef = useRef(null)
  const conversaIdRef = useRef(null)

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
  const { dados: solicitacoes, carregando: carregandoCompras, erro: erroCompras } =
    useColecaoQuandoPermitido('solicitacoes_compra', permitidos.includes('compras'), RESTRICOES_MOVIMENTO)

  // Resumo compacto injetado no system prompt. Colecao ainda carregando (ou que falhou
  // ao ler) fica de fora — o agente continua respondendo, so sem aquele bloco de dados.
  // Melhor nao ter o dado do que afirmar "0 em aberto" por causa de uma leitura falha.
  const resumoDados = useMemo(() => {
    const pronto = (bloco, carregandoCol, erroCol) => permitidos.includes(bloco) && !carregandoCol && !erroCol
    const blocos = []
    if (pronto('filtros', carregandoFiltros, erroFiltros)) blocos.push(resumoFiltros(filtros))
    if (pronto('geradores', carregandoGeradores, erroGeradores)) blocos.push(resumoGeradores(geradores))
    if (pronto('veiculos', carregandoVeiculos, erroVeiculos)) blocos.push(resumoVeiculos(veiculos, geradores))
    if (pronto('os', carregandoOrdens, erroOrdens)) blocos.push(resumoOrdens(ordens))
    if (pronto('eventos', carregandoEventos, erroEventos)) blocos.push(resumoEventos(eventos))
    if (pronto('materiais', carregandoMateriais, erroMateriais)) blocos.push(resumoMateriais(materiais))
    if (pronto('compras', carregandoCompras, erroCompras)) blocos.push(resumoCompras(solicitacoes))
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
    permitidos,
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
    solicitacoes, carregandoCompras, erroCompras,
  ])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Grava a conversa em conversas_agente com um respiro de 1,5s, para nao escrever
  // a cada mensagem em sequencia. O anexo NAO vai junto (so o nome dele) por causa
  // do limite de 1 MB por documento do Firestore.
  useEffect(() => {
    if (!uid || mensagens.length < 2) return
    const timer = setTimeout(async () => {
      const registros = mensagens.slice(-MAX_MENSAGENS_SALVAS).map(mensagemParaFirestore)
      try {
        if (conversaIdRef.current) {
          await updateDoc(doc(db, 'conversas_agente', conversaIdRef.current), {
            mensagens: registros,
            atualizadoEm: serverTimestamp(),
          })
        } else {
          const criada = await addDoc(collection(db, 'conversas_agente'), {
            uid,
            usuarioNome: nome || '',
            perfil: tipoPerfil || '',
            titulo: tituloDaConversa(mensagens),
            mensagens: registros,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
          })
          conversaIdRef.current = criada.id
        }
      } catch (e) {
        console.error('AgenteChat salvar conversa:', e)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [mensagens, uid, nome, tipoPerfil])

  async function abrirHistorico() {
    setHistoricoAberto(true)
    if (!uid) return
    setCarregandoHistorico(true)
    try {
      // Filtra so por uid: somar orderBy aqui exigiria indice composto no
      // Firestore, entao a ordenacao por data e feita abaixo, no cliente.
      const snap = await getDocs(query(collection(db, 'conversas_agente'), where('uid', '==', uid)))
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0))
      setConversas(lista.slice(0, 30))
    } catch (e) {
      console.error('AgenteChat carregar histórico:', e)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  function novaConversa() {
    conversaIdRef.current = null
    setMensagens([saudacao(nome)])
    setInput('')
    setAnexo(null)
    setErroAnexo('')
    setHistoricoAberto(false)
  }

  function abrirConversa(conversa) {
    conversaIdRef.current = conversa.id
    setMensagens(conversa.mensagens?.length ? conversa.mensagens : [saudacao(nome)])
    setAnexo(null)
    setErroAnexo('')
    setHistoricoAberto(false)
  }

  async function excluirConversa(evento, conversa) {
    evento.stopPropagation()
    if (!window.confirm(`Excluir a conversa "${conversa.titulo || 'sem título'}"?`)) return
    try {
      await deleteDoc(doc(db, 'conversas_agente', conversa.id))
      setConversas(prev => prev.filter(c => c.id !== conversa.id))
      if (conversaIdRef.current === conversa.id) novaConversa()
    } catch (e) {
      console.error('AgenteChat excluir conversa:', e)
    }
  }

  async function escolherArquivo(evento) {
    const file = evento.target.files?.[0]
    evento.target.value = ''
    if (!file) return
    setErroAnexo('')
    try {
      if (file.type === 'application/pdf') {
        if (file.size > PDF_MAX_BYTES) { setErroAnexo('PDF muito grande — o limite é 4 MB.'); return }
        setAnexo({ tipo: 'pdf', dados: await arquivoParaBase64(file), nome: file.name })
      } else if (file.type?.startsWith('image/')) {
        const dataUrl = await comprimirParaDataUrl(file)
        setAnexo({
          tipo: 'imagem',
          dados: dataUrl.split(',')[1],
          mediaType: 'image/jpeg',
          nome: file.name,
          preview: dataUrl,
        })
      } else {
        setErroAnexo('Envie uma foto ou um PDF.')
      }
    } catch (e) {
      setErroAnexo(e.message || 'Não foi possível ler o arquivo.')
    }
  }

  async function enviar(texto) {
    const msg = texto || input.trim()
    // Atalho nunca leva anexo junto — o arquivo escolhido fica esperando o envio.
    const anexoEnviado = texto ? null : anexo
    if ((!msg && !anexoEnviado) || carregando) return
    setInput('')
    if (anexoEnviado) setAnexo(null)
    const nova = { role: 'user', content: msg, ...(anexoEnviado ? { anexo: anexoEnviado } : {}) }
    setMensagens(prev => [...prev, nova])
    setCarregando(true)

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Agente IA não configurado. Adicione VITE_ANTHROPIC_API_KEY no arquivo .env para ativar.' }])
      setCarregando(false)
      return
    }

    const fichaOs = permitidos.includes('os') && !carregandoOrdens && !erroOrdens
      ? detalharOrdens(ordens, carregandoFiltros || erroFiltros ? [] : filtros, msg)
      : null

    try {
      const historico = [...mensagens, nova]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: conteudoParaApi(m) }))

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
          // A ficha da OS depende da pergunta (qual OS/equipamento foi citado), entao
          // e montada aqui no envio, e nao no useMemo do resumo geral.
          system: systemPrompt(tipoPerfil, nome, [resumoDados, fichaOs].filter(Boolean).join('\n\n')),
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
      className={compact ? 'relative' : 'relative flex flex-col h-[calc(100vh-180px)]'}>

      <div className="flex-shrink-0 flex items-center gap-2 mb-2">
        <button onClick={novaConversa}
          className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          + Nova conversa
        </button>
        <button onClick={abrirHistorico}
          className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          Histórico
        </button>
      </div>

      {historicoAberto && (
        <div className="absolute inset-0 z-20 bg-white rounded-2xl border border-gray-100 shadow-lg flex flex-col overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-brand-black">Conversas anteriores</span>
            <button onClick={() => setHistoricoAberto(false)} className="text-gray-400 hover:text-brand-red transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ minHeight: 0 }}>
            {carregandoHistorico && <p className="text-xs text-gray-400 px-2 py-3">Carregando...</p>}
            {!carregandoHistorico && conversas.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-3">Nenhuma conversa salva ainda.</p>
            )}
            {conversas.map(c => (
              <button key={c.id} onClick={() => abrirConversa(c)}
                className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-start gap-2 ${conversaIdRef.current === c.id ? 'bg-brand-red/10' : 'hover:bg-gray-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-black truncate">{c.titulo || 'Sem título'}</p>
                  <p className="text-xs text-gray-400">
                    {formatarDataHora(c.atualizadoEm)} · {c.mensagens?.length || 0} mensagens
                  </p>
                </div>
                <span onClick={e => excluirConversa(e, c)}
                  className="flex-shrink-0 text-xs text-gray-300 hover:text-brand-red transition-colors px-1">
                  Excluir
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
              {(m.anexo || m.anexoNome) && (
                <div className="mb-2">
                  {m.anexo?.preview ? (
                    <img src={m.anexo.preview} alt={m.anexo.nome || 'anexo'}
                      className="rounded-xl max-h-40 w-auto" />
                  ) : (
                    <span className={`inline-block text-xs px-2 py-1 rounded-lg ${m.role === 'user' ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                      📎 {m.anexo?.nome || m.anexoNome}
                    </span>
                  )}
                </div>
              )}
              {m.content && (m.role === 'assistant'
                ? <MensagemFormatada texto={m.content} />
                : <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              )}
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

      {(anexo || erroAnexo) && (
        <div className="flex-shrink-0 mt-2">
          {anexo && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              {anexo.preview
                ? <img src={anexo.preview} alt={anexo.nome} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                : <span className="text-lg flex-shrink-0">📄</span>}
              <span className="text-xs text-gray-600 truncate flex-1">{anexo.nome}</span>
              <button onClick={() => setAnexo(null)} className="text-xs text-gray-400 hover:text-brand-red transition-colors flex-shrink-0">
                Remover
              </button>
            </div>
          )}
          {erroAnexo && <p className="text-xs text-brand-red mt-1">{erroAnexo}</p>}
        </div>
      )}

      <div className="flex-shrink-0 flex gap-2 mt-3">
        <input ref={arquivoRef} type="file" accept="image/*,application/pdf" onChange={escolherArquivo} className="hidden" />
        <button onClick={() => arquivoRef.current?.click()} title="Anexar foto ou PDF"
          className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
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
          className="input flex-1 min-w-0"
          disabled={carregando}
        />
        <button onClick={() => enviar()} disabled={(!input.trim() && !anexo) || carregando}
          className="w-10 h-10 flex-shrink-0 bg-brand-red text-white rounded-full flex items-center justify-center hover:bg-brand-red-dark transition-colors disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
