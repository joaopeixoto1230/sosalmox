import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { normalizarRef } from '../filtros/filtrosUtils'
import { statusGeradorLabel, statusMaterialLabel, statusOsLabel } from '../../utils/formatters'

const ATALHOS = [
  { label: 'Filtros', prompt: 'Quais filtros estão com estoque baixo?' },
  { label: 'Geradores', prompt: 'Me dê um resumo do status dos geradores.' },
  { label: 'Manutenção', prompt: 'Quais manutenções estão em aberto?' },
  { label: 'Cabos', prompt: 'Como identifico um jogo de cabo?' },
  { label: 'Estoque', prompt: 'O que preciso verificar no estoque hoje?' },
]

// Quais blocos de dados reais entram no prompt de cada perfil. Injetar dado que o
// perfil nem enxerga no sistema so gasta token e polui a resposta: o mecanico nao
// precisa da contagem de cabos, o comprador nao precisa do status da frota.
const DADOS_POR_PERFIL = {
  admin: ['filtros', 'geradores', 'os', 'materiais'],
  gerente: ['filtros', 'geradores', 'os', 'materiais'],
  almoxarife: ['filtros', 'geradores', 'os', 'materiais'],
  franca: ['filtros', 'geradores', 'os'],
  compras: ['filtros', 'materiais'],
}
const DADOS_PADRAO = ['filtros', 'geradores']

// Teto de itens listados por bloco. O resumo vai em TODA requisicao, entao ele
// precisa ser curto: contagens sempre, e so os criticos nomeados um a um.
const LIMITE_LISTA = 12

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
  return `ESTOQUE (materiais e cabos): ${materiais.length} itens — ${contagem}.`
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
- Responda APENAS sobre assuntos da SOS Energia (materiais, cabos, filtros, geradores, veículos, manutenção, estoque, compras)
- Respostas curtas: máximo 3 parágrafos
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

Use esses números ao responder — eles são a situação atual, não estimativa. Cite códigos e
quantidades quando ajudar. Se a pergunta pedir um dado que não está aí em cima, diga que não
tem essa informação em vez de inventar.` : ''}`
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

  // Resumo compacto injetado no system prompt. Colecao ainda carregando (ou que falhou
  // ao ler) fica de fora — o agente continua respondendo, so sem aquele bloco de dados.
  // Melhor nao ter o dado do que afirmar "0 em aberto" por causa de uma leitura falha.
  const resumoDados = useMemo(() => {
    const permitidos = DADOS_POR_PERFIL[tipoPerfil] || DADOS_PADRAO
    const pronto = (bloco, carregandoCol, erroCol) => permitidos.includes(bloco) && !carregandoCol && !erroCol
    const blocos = []
    if (pronto('filtros', carregandoFiltros, erroFiltros)) blocos.push(resumoFiltros(filtros))
    if (pronto('geradores', carregandoGeradores, erroGeradores)) blocos.push(resumoGeradores(geradores))
    if (pronto('os', carregandoOrdens, erroOrdens)) blocos.push(resumoOrdens(ordens))
    if (pronto('materiais', carregandoMateriais, erroMateriais)) blocos.push(resumoMateriais(materiais))
    return blocos.filter(Boolean).join('\n\n') || null
  }, [
    tipoPerfil,
    filtros, carregandoFiltros, erroFiltros,
    geradores, carregandoGeradores, erroGeradores,
    ordens, carregandoOrdens, erroOrdens,
    materiais, carregandoMateriais, erroMateriais,
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
          max_tokens: 400,
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
        <div className="flex-shrink-0 flex gap-1.5 mt-2 flex-wrap">
          {ATALHOS.map(a => (
            <button key={a.label} onClick={() => enviar(a.prompt)}
              className="px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full hover:bg-brand-red hover:text-white transition-colors">
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
