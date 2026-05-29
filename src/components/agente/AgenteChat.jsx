import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

const ATALHOS = [
  { label: 'Filtros', prompt: 'Quais filtros estão com estoque baixo?' },
  { label: 'Geradores', prompt: 'Me dê um resumo do status dos geradores.' },
  { label: 'Manutenção', prompt: 'Quais manutenções estão em aberto?' },
  { label: 'Cabos', prompt: 'Como identifico um jogo de cabo?' },
  { label: 'Estoque', prompt: 'O que preciso verificar no estoque hoje?' },
]

function systemPrompt(perfil, nomeUsuario) {
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
- Responda APENAS sobre assuntos da SOS Energia (materiais, cabos, filtros, geradores, manutenção, estoque)
- Respostas curtas: máximo 3 parágrafos
- Linguagem simples, direta, sem jargão desnecessário
- Se não souber, diga "Não tenho essa informação ainda" e explique o que precisa ser alimentado
- A SOS Energia tem ~107 geradores (GG-001 a GG-107), cabos de 4x6 a 4x50mm², filtros organizados por potência de GG (30kVA a 500kVA), caminhões identificados por placa e 2 empilhadeiras`
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

      const res = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt(tipoPerfil, nome),
          messages: historico,
        }),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json()
      const resposta = data.content?.[0]?.text || 'Sem resposta.'
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
    } catch (e) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com o Agente. Tente novamente.' }])
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
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[calc(100vh-180px)]'}`}>
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

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
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
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {ATALHOS.map(a => (
            <button key={a.label} onClick={() => enviar(a.prompt)}
              className="px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full hover:bg-brand-red hover:text-white transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
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
