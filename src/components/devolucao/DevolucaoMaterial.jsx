import { useState, useMemo } from 'react'
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import ItemDevolucao from './ItemDevolucao'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../utils/formatters'

export default function DevolucaoMaterial() {
  const { uid, nome } = useAuth()
  const { dados: eventos } = useCollection('eventos')
  const { dados: ordens } = useCollection('ordens_saida')

  const [eventoSelecionado, setEventoSelecionado] = useState(null)
  const [statusItens, setStatusItens] = useState({})
  const [descricoes, setDescricoes] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  const eventosComOrdem = useMemo(() => {
    const idsComOrdem = new Set(ordens.filter(o => o.status === 'ativo').map(o => o.eventoId))
    return eventos.filter(e => idsComOrdem.has(e.id))
  }, [eventos, ordens])

  const ordensDoEvento = useMemo(() => {
    if (!eventoSelecionado) return []
    return ordens.filter(o => o.eventoId === eventoSelecionado.id && o.status === 'ativo')
  }, [ordens, eventoSelecionado])

  const todosItens = useMemo(() => {
    const mapa = new Map()
    ordensDoEvento.forEach(o => {
      o.itens?.forEach(item => {
        if (!mapa.has(item.id)) mapa.set(item.id, item)
      })
    })
    return Array.from(mapa.values())
  }, [ordensDoEvento])

  function handleStatus(itemId, valor) {
    setStatusItens(prev => ({ ...prev, [itemId]: valor }))
  }

  function handleDescricao(itemId, valor) {
    setDescricoes(prev => ({ ...prev, [itemId]: valor }))
  }

  const statusResumo = useMemo(() => {
    const totais = { ok: 0, problema: 0, cortado: 0, perdido: 0, parcial: 0, aguardando: 0 }
    todosItens.forEach(item => {
      const s = statusItens[item.id] || 'aguardando'
      totais[s] = (totais[s] || 0) + 1
    })
    return totais
  }, [todosItens, statusItens])

  const podeConcluir = todosItens.length > 0 && todosItens.every(item => {
    const s = statusItens[item.id]
    if (!s || s === 'aguardando') return false
    if ((s === 'problema' || s === 'cortado') && !descricoes[item.id]?.trim()) return false
    return true
  })

  async function confirmarDevolucao() {
    setSalvando(true)
    setErro('')
    try {
      await runTransaction(db, async (tx) => {
        for (const item of todosItens) {
          const matRef = doc(db, 'materiais', item.id)
          const snap = await tx.get(matRef)
          if (!snap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
          if (snap.data().status !== 'em_evento') {
            throw new Error(`${item.nome} já foi devolvido ou está em outro estado. Recarregue a página.`)
          }
        }

        const devRef = doc(collection(db, 'devolucoes'))
        tx.set(devRef, {
          eventoId: eventoSelecionado.id,
          eventoNome: eventoSelecionado.nome,
          itens: todosItens.map(item => ({
            ...item,
            statusDevolucao: statusItens[item.id] || 'aguardando',
            descricao: descricoes[item.id] || null,
          })),
          operadorUid: uid,
          operadorNome: nome,
          criadoEm: serverTimestamp(),
        })

        for (const item of todosItens) {
          const s = statusItens[item.id] || 'aguardando'
          const matRef = doc(db, 'materiais', item.id)
          if (s === 'ok' || s === 'cortado') {
            tx.update(matRef, { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 })
          } else if (s === 'perdido') {
            tx.update(matRef, { status: 'perdido', eventoAtual: null })
          } else if (s === 'problema') {
            tx.update(matRef, { status: 'manutencao', eventoAtual: null })
          }
        }

        for (const ordem of ordensDoEvento) {
          const ordemRef = doc(db, 'ordens_saida', ordem.id)
          tx.update(ordemRef, { status: 'devolvida' })
        }

        // Devolvido todo o material do evento → conclui o evento (Ativo → Concluído)
        const eventoRef = doc(db, 'eventos', eventoSelecionado.id)
        tx.update(eventoRef, { status: 'concluido' })
      })

      setConcluido(true)
    } catch (err) {
      setErro(err.message || 'Erro ao registrar devolução.')
    } finally {
      setSalvando(false)
    }
  }

  if (concluido) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12 space-y-4 card">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-black">Devolução Registrada!</h2>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto text-sm">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-green-700">{statusResumo.ok}</p>
              <p className="text-green-600 text-xs">OK</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-yellow-700">{statusResumo.problema + statusResumo.cortado}</p>
              <p className="text-yellow-600 text-xs">Problemas</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-red-700">{statusResumo.perdido}</p>
              <p className="text-red-600 text-xs">Perdidos</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEventoSelecionado(null)
              setStatusItens({})
              setDescricoes({})
              setConcluido(false)
            }}
            className="btn-primary mx-auto"
          >
            Nova Devolução
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Devolução de Material</h1>
        <p className="text-gray-500 text-sm mt-1">Registre o retorno dos materiais de campo.</p>
      </div>

      {!eventoSelecionado ? (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-brand-black mb-3">Selecionar Evento</h2>
            <input
              type="search"
              placeholder="Buscar evento..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input mb-3"
            />
            {eventosComOrdem.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum evento com material em campo.</p>
            ) : (
              <div className="space-y-2">
                {eventosComOrdem
                  .filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()))
                  .map(evt => (
                    <button
                      key={evt.id}
                      onClick={() => setEventoSelecionado(evt)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-brand-red hover:bg-red-50/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors">{evt.nome}</p>
                          <p className="text-xs text-gray-500">{evt.local} • {formatarData(evt.data)}</p>
                        </div>
                        <span className={`badge ${statusEventoCor(evt.status)}`}>
                          {statusEventoLabel(evt.status)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card bg-gray-50 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-black">{eventoSelecionado.nome}</p>
                <p className="text-xs text-gray-500">{todosItens.length} itens para devolver</p>
              </div>
              <button
                onClick={() => { setEventoSelecionado(null); setStatusItens({}); setDescricoes({}) }}
                className="text-sm text-brand-red hover:underline"
              >
                Trocar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {todosItens.map(item => (
              <ItemDevolucao
                key={item.id}
                item={item}
                statusAtual={statusItens[item.id]}
                descricao={descricoes[item.id]}
                onStatus={handleStatus}
                onDescricao={handleDescricao}
              />
            ))}
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <button
            onClick={confirmarDevolucao}
            disabled={!podeConcluir || salvando}
            className="btn-primary w-full justify-center py-3"
          >
            {salvando ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Salvando...
              </>
            ) : `Confirmar Devolução (${todosItens.length} itens)`}
          </button>
          {!podeConcluir && todosItens.length > 0 && (
            <p className="text-xs text-gray-400 text-center">Marque o status de todos os itens para continuar.</p>
          )}
        </div>
      )}
    </div>
  )
}
