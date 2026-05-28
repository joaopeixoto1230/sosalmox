import { useState, useMemo } from 'react'
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../utils/formatters'

export default function Transferencia() {
  const { uid, nome } = useAuth()
  const { dados: eventos } = useCollection('eventos')
  const { dados: ordens } = useCollection('ordens_saida')

  const [etapa, setEtapa] = useState('origem')
  const [eventoOrigem, setEventoOrigem] = useState(null)
  const [eventoDestino, setEventoDestino] = useState(null)
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  const eventosAtivos = useMemo(() => {
    const idsComOrdem = new Set(ordens.filter(o => o.status === 'ativo').map(o => o.eventoId))
    return eventos.filter(e => idsComOrdem.has(e.id))
  }, [eventos, ordens])

  const itensOrigem = useMemo(() => {
    if (!eventoOrigem) return []
    const mapa = new Map()
    ordens.filter(o => o.eventoId === eventoOrigem.id && o.status === 'ativo').forEach(o => {
      o.itens?.forEach(item => { if (!mapa.has(item.id)) mapa.set(item.id, item) })
    })
    return Array.from(mapa.values())
  }, [ordens, eventoOrigem])

  function toggleItem(item) {
    setItensSelecionados(prev =>
      prev.some(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]
    )
  }

  async function confirmarTransferencia() {
    setSalvando(true)
    setErro('')
    try {
      const ordensOrigem = ordens.filter(o => o.eventoId === eventoOrigem.id && o.status === 'ativo')
      const idsTransferidos = new Set(itensSelecionados.map(i => i.id))

      await runTransaction(db, async (tx) => {
        const transRef = doc(collection(db, 'transferencias'))
        tx.set(transRef, {
          eventoOrigemId: eventoOrigem.id,
          eventoOrigemNome: eventoOrigem.nome,
          eventoDestinoId: eventoDestino.id,
          eventoDestinoNome: eventoDestino.nome,
          itens: itensSelecionados,
          motivo,
          operadorUid: uid,
          operadorNome: nome,
          criadoEm: serverTimestamp(),
        })

        for (const item of itensSelecionados) {
          const matRef = doc(db, 'materiais', item.id)
          tx.update(matRef, { eventoAtual: eventoDestino.id })
        }

        for (const ordem of ordensOrigem) {
          const itensRestantes = (ordem.itens || []).filter(i => !idsTransferidos.has(i.id))
          const ordemRef = doc(db, 'ordens_saida', ordem.id)
          if (itensRestantes.length === 0) {
            tx.update(ordemRef, { status: 'transferida' })
          } else {
            tx.update(ordemRef, { itens: itensRestantes })
          }
        }
      })
      setConcluido(true)
    } catch (err) {
      setErro(err.message || 'Erro ao registrar transferência.')
    } finally {
      setSalvando(false)
    }
  }

  if (concluido) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12 card space-y-4">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-black">Transferência Registrada!</h2>
          <p className="text-gray-500 text-sm">
            <span className="font-medium">{itensSelecionados.length} itens</span> transferidos de{' '}
            <span className="font-medium">{eventoOrigem?.nome}</span> para{' '}
            <span className="font-medium">{eventoDestino?.nome}</span>.
          </p>
          <button
            onClick={() => {
              setEtapa('origem'); setEventoOrigem(null); setEventoDestino(null)
              setItensSelecionados([]); setMotivo(''); setConcluido(false)
            }}
            className="btn-primary mx-auto"
          >
            Nova Transferência
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Transferência entre Eventos</h1>
        <p className="text-gray-500 text-sm mt-1">Mova materiais diretamente entre eventos sem passar pelo almoxarifado.</p>
      </div>

      {etapa === 'origem' && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-brand-black">Evento de Origem</h2>
          <input type="search" placeholder="Buscar evento..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
          {eventosAtivos.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase())).map(evt => (
            <button key={evt.id} onClick={() => { setEventoOrigem(evt); setBusca(''); setEtapa('itens') }}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-brand-red hover:bg-red-50/30 transition-all group">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors">{evt.nome}</p>
                  <p className="text-xs text-gray-500">{evt.local} • {formatarData(evt.data)}</p>
                </div>
                <span className={`badge ${statusEventoCor(evt.status)}`}>{statusEventoLabel(evt.status)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {etapa === 'itens' && (
        <div className="space-y-4">
          <div className="card bg-gray-50 border-gray-200">
            <div className="flex items-center justify-between">
              <p className="font-medium text-brand-black">Origem: {eventoOrigem?.nome}</p>
              <button onClick={() => { setEtapa('origem'); setEventoOrigem(null); setItensSelecionados([]) }} className="text-sm text-brand-red">Trocar</button>
            </div>
          </div>
          <h2 className="font-semibold text-brand-black">Selecionar itens para transferir</h2>
          {itensOrigem.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Nenhum item encontrado para este evento.</p>
          ) : (
            <div className="space-y-2">
              {itensOrigem.map(item => {
                const sel = itensSelecionados.some(i => i.id === item.id)
                return (
                  <button key={item.id} onClick={() => toggleItem(item)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${sel ? 'border-brand-red bg-red-50/30 ring-1 ring-brand-red/20' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${sel ? 'bg-brand-red border-brand-red' : 'border-gray-300'}`}>
                        {sel && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div>
                        <p className="font-medium text-brand-black text-sm">{item.nome}</p>
                        <p className="text-xs text-brand-red font-mono">{item.codigo}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setEtapa('origem'); setItensSelecionados([]) }} className="btn-secondary">← Voltar</button>
            <button onClick={() => setEtapa('destino')} disabled={itensSelecionados.length === 0} className="btn-primary flex-1 justify-center">
              Selecionar Destino ({itensSelecionados.length}) →
            </button>
          </div>
        </div>
      )}

      {etapa === 'destino' && (
        <div className="space-y-4">
          <div className="card bg-gray-50 border-gray-200 space-y-1">
            <p className="text-sm text-gray-500">Origem: <span className="font-medium text-brand-black">{eventoOrigem?.nome}</span></p>
            <p className="text-sm text-gray-500">Itens: <span className="font-medium text-brand-black">{itensSelecionados.length}</span></p>
          </div>
          <h2 className="font-semibold text-brand-black">Evento de Destino</h2>
          <input type="search" placeholder="Buscar evento destino..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
          <div className="space-y-2">
            {eventos
              .filter(e => e.id !== eventoOrigem?.id && ['ativo', 'agendado'].includes(e.status))
              .filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()))
              .map(evt => (
                <button key={evt.id} onClick={() => { setEventoDestino(evt); setBusca(''); setEtapa('confirmar') }}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-brand-red hover:bg-red-50/30 transition-all group">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors">{evt.nome}</p>
                      <p className="text-xs text-gray-500">{evt.local} • {formatarData(evt.data)}</p>
                    </div>
                    <span className={`badge ${statusEventoCor(evt.status)}`}>{statusEventoLabel(evt.status)}</span>
                  </div>
                </button>
              ))}
          </div>
          <button onClick={() => setEtapa('itens')} className="btn-ghost">← Voltar</button>
        </div>
      )}

      {etapa === 'confirmar' && (
        <div className="space-y-4">
          <div className="card bg-gray-50 border-gray-200 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">De:</span>
              <span className="text-brand-black font-semibold">{eventoOrigem?.nome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Para:</span>
              <span className="text-brand-black font-semibold">{eventoDestino?.nome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Itens:</span>
              <span className="text-brand-black">{itensSelecionados.map(i => i.nome).join(', ')}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Observação</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que está sendo transferido?" rows={2} className="input resize-none" />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{erro}</div>}
          <div className="flex gap-3">
            <button onClick={() => setEtapa('destino')} className="btn-secondary">← Voltar</button>
            <button onClick={confirmarTransferencia} disabled={salvando} className="btn-primary flex-1 justify-center">
              {salvando ? 'Salvando...' : 'Confirmar Transferência'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
