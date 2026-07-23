import { useState, useMemo } from 'react'
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import ItemDevolucao from './ItemDevolucao'
import { formatarData, statusEventoCor, statusEventoLabel, formatarNumeroOrdem, statusGeradorLabel, materialPorQuantidade } from '../../utils/formatters'

export default function DevolucaoMaterial() {
  const { uid, nome } = useAuth()
  const { dados: eventos } = useCollection('eventos')
  const { dados: ordens } = useCollection('ordens_saida')
  const { dados: geradores } = useCollection('geradores')

  const [eventoSelecionado, setEventoSelecionado] = useState(null)
  const [statusItens, setStatusItens] = useState({})
  const [descricoes, setDescricoes] = useState({})
  const [destinoGeradores, setDestinoGeradores] = useState({})
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

  const geradoresDoEvento = useMemo(() => {
    if (!eventoSelecionado) return []
    return geradores.filter(g => g.eventoAtual === eventoSelecionado.id)
  }, [geradores, eventoSelecionado])

  const eventosDestino = useMemo(() => {
    if (!eventoSelecionado) return []
    return eventos
      .filter(e => e.id !== eventoSelecionado.id && e.status !== 'concluido')
      .sort((a, b) => new Date(b.data) - new Date(a.data))
  }, [eventos, eventoSelecionado])

  function handleStatus(itemId, valor) {
    setStatusItens(prev => ({ ...prev, [itemId]: valor }))
  }

  function handleDescricao(itemId, valor) {
    setDescricoes(prev => ({ ...prev, [itemId]: valor }))
  }

  function setDestino(ggId, patch) {
    setDestinoGeradores(prev => ({ ...prev, [ggId]: { ...prev[ggId], ...patch } }))
  }

  const geradoresValidos = geradoresDoEvento.every(g => {
    const d = destinoGeradores[g.id]
    if (!d || d.tipo === 'devolver') return true
    if (d.tipo === 'evento') return !!d.eventoDestinoId
    if (d.tipo === 'locacao') return !!d.localLocacao?.trim()
    return true
  })

  const statusResumo = useMemo(() => {
    const totais = { ok: 0, problema: 0, cortado: 0, perdido: 0, parcial: 0, aguardando: 0 }
    todosItens.forEach(item => {
      const s = statusItens[item.id] || 'aguardando'
      totais[s] = (totais[s] || 0) + 1
    })
    return totais
  }, [todosItens, statusItens])

  const podeConcluir = todosItens.length > 0 && geradoresValidos && todosItens.every(item => {
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
        // ===== LEITURAS (todas antes de qualquer escrita) =====
        // Guarda o status atual de cada material. Consumíveis (protetor de cabo)
        // não ficam "em_evento" ao sair, então são ignorados aqui. Materiais que
        // já voltaram por outro caminho (conclusão de evento etc.) também não
        // travam a devolução — apenas não têm o estoque alterado de novo.
        const statusAtualMat = {}
        for (const item of todosItens) {
          if (materialPorQuantidade(item)) continue
          const matRef = doc(db, 'materiais', item.id)
          const snap = await tx.get(matRef)
          if (!snap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
          statusAtualMat[item.id] = snap.data().status
        }

        // Se algum gerador vai ser transferido para outro evento, cada um gera
        // uma nova ordem de saída — lê o contador uma vez antes das escritas.
        const transferenciasEvento = geradoresDoEvento.filter(g => {
          const d = destinoGeradores[g.id]
          return d?.tipo === 'evento' && d.eventoDestinoId
        })
        const contadorRef = doc(db, 'contadores', 'ordens_saida')
        let proximoNumero = null
        if (transferenciasEvento.length > 0) {
          const contSnap = await tx.get(contadorRef)
          proximoNumero = contSnap.exists() ? contSnap.data().ultimo : 0
        }

        // ===== ESCRITAS =====
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
          // Consumível por quantidade: não prende estoque, nada a alterar aqui.
          if (materialPorQuantidade(item)) continue
          // Só devolve o que ainda está no evento. Se já voltou por outro
          // fluxo, segue no registro sem mexer no estoque de novo.
          if (statusAtualMat[item.id] !== 'em_evento') continue
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

        // Destino de cada gerador que estava no evento. Sem escolha = devolver.
        for (const gg of geradoresDoEvento) {
          const ggRef = doc(db, 'geradores', gg.id)
          const destino = destinoGeradores[gg.id] || { tipo: 'devolver' }

          if (destino.tipo === 'evento' && destino.eventoDestinoId) {
            const eventoDest = eventos.find(e => e.id === destino.eventoDestinoId)
            proximoNumero += 1
            const localDest = eventoDest
              ? `${eventoDest.nome}${eventoDest.local ? ' · ' + eventoDest.local : ''}`
              : 'Em evento'
            const novaOrdemRef = doc(collection(db, 'ordens_saida'))
            tx.set(novaOrdemRef, {
              numero: proximoNumero,
              numeroFormatado: formatarNumeroOrdem(proximoNumero),
              eventoId: destino.eventoDestinoId,
              eventoNome: eventoDest?.nome || null,
              geradores: [{ id: gg.id, codigo: gg.codigo }],
              geradorCodigo: gg.codigo,
              itens: [],
              observacoes: `Transferido do evento "${eventoSelecionado.nome}" via devolução.`,
              responsavelNome: null,
              operadorUid: uid,
              operadorNome: nome,
              status: 'ativo',
              criadoEm: serverTimestamp(),
            })
            tx.update(ggRef, {
              status: 'em_evento',
              eventoAtual: destino.eventoDestinoId,
              eventoNome: eventoDest?.nome || null,
              localizacao: localDest,
            })
          } else if (destino.tipo === 'locacao') {
            tx.update(ggRef, {
              status: 'locacao',
              eventoAtual: null,
              eventoNome: null,
              localizacao: destino.localLocacao?.trim() || 'Locação',
            })
          } else {
            tx.update(ggRef, {
              status: 'disponivel',
              eventoAtual: null,
              eventoNome: null,
              localizacao: 'Pátio SOS',
            })
          }
        }

        if (transferenciasEvento.length > 0) {
          tx.set(contadorRef, { ultimo: proximoNumero }, { merge: true })
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
              setDestinoGeradores({})
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
                onClick={() => { setEventoSelecionado(null); setStatusItens({}); setDescricoes({}); setDestinoGeradores({}) }}
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

          {geradoresDoEvento.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <svg className="w-4 h-4 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="font-semibold text-brand-black">Geradores do evento</h2>
                <span className="text-xs text-gray-400">({geradoresDoEvento.length})</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                Defina o destino de cada gerador. Sem escolher, o gerador volta ao Pátio como disponível.
              </p>

              {geradoresDoEvento.map(gg => {
                const destino = destinoGeradores[gg.id] || { tipo: 'devolver' }
                const opcoes = [
                  { tipo: 'devolver', label: 'Devolver ao Pátio' },
                  { tipo: 'evento', label: 'Transferir p/ evento' },
                  { tipo: 'locacao', label: 'Transferir p/ locação' },
                ]
                return (
                  <div key={gg.id} className="card space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-brand-black">{gg.codigo}</p>
                        <p className="text-xs text-gray-500">
                          {gg.potencia || '—'}{gg.marca ? ` · ${gg.marca}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{statusGeradorLabel(gg.status)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {opcoes.map(op => {
                        const ativo = destino.tipo === op.tipo
                        return (
                          <button
                            key={op.tipo}
                            onClick={() => setDestino(gg.id, { tipo: op.tipo })}
                            className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-colors
                              ${ativo ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}
                          >
                            {op.label}
                          </button>
                        )
                      })}
                    </div>

                    {destino.tipo === 'evento' && (
                      eventosDestino.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Nenhum outro evento ativo/agendado disponível para transferência.
                        </p>
                      ) : (
                        <select
                          value={destino.eventoDestinoId || ''}
                          onChange={e => setDestino(gg.id, { eventoDestinoId: e.target.value })}
                          className="input"
                        >
                          <option value="">Selecione o evento de destino...</option>
                          {eventosDestino.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.nome}{e.local ? ` — ${e.local}` : ''}
                            </option>
                          ))}
                        </select>
                      )
                    )}

                    {destino.tipo === 'locacao' && (
                      <input
                        type="text"
                        placeholder="Local da locação (ex: Cliente XYZ — Obra Centro)"
                        value={destino.localLocacao || ''}
                        onChange={e => setDestino(gg.id, { localLocacao: e.target.value })}
                        className="input"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

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
