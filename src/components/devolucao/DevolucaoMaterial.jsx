import { useState, useMemo } from 'react'
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import ItemDevolucao from './ItemDevolucao'
import { formatarData, statusEventoCor, statusEventoLabel, formatarNumeroOrdem, statusGeradorLabel, materialPorQuantidade } from '../../utils/formatters'
import { materialContado, patchDevolucaoEvento } from '../estoque/contagem'
import { itensPorEvento, filtrarEventosDevolucao, itensPendentesDevolucao, itemLancavelSozinho } from './buscaDevolucao'

export default function DevolucaoMaterial() {
  const { uid, nome } = useAuth()
  const { dados: eventos } = useCollection('eventos')
  const { dados: ordens } = useCollection('ordens_saida')
  const { dados: geradores } = useCollection('geradores')
  const { dados: materiais } = useCollection('materiais')

  const [eventoSelecionado, setEventoSelecionado] = useState(null)
  const [statusItens, setStatusItens] = useState({})
  const [descricoes, setDescricoes] = useState({})
  const [destinoGeradores, setDestinoGeradores] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [lancandoItem, setLancandoItem] = useState(null)
  const [concluido, setConcluido] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  const eventosComOrdem = useMemo(() => {
    const idsComOrdem = new Set(ordens.filter(o => o.status === 'ativo').map(o => o.eventoId))
    return eventos.filter(e => idsComOrdem.has(e.id))
  }, [eventos, ordens])

  // Busca por evento E por material: digitar o nome (ou código) do cabo acha
  // os eventos que têm aquele item em campo, mostrando o item que casou.
  const mapaItens = useMemo(() => itensPorEvento(ordens), [ordens])
  const eventosFiltrados = useMemo(
    () => filtrarEventosDevolucao(eventosComOrdem, mapaItens, busca),
    [eventosComOrdem, mapaItens, busca],
  )

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

  const materiaisMap = useMemo(() => new Map(materiais.map(m => [m.id, m])), [materiais])

  // Só o que AINDA está em campo: item lançado individualmente sai da lista,
  // senão a confirmação final o registraria de novo.
  const pendentes = useMemo(
    () => itensPendentesDevolucao(todosItens, materiaisMap),
    [todosItens, materiaisMap],
  )

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

  // Sai do evento e limpa o que já tinha sido marcado — os status são daquele
  // evento, não podem vazar para o próximo que for aberto.
  function voltarParaLista() {
    setEventoSelecionado(null)
    setStatusItens({})
    setDescricoes({})
    setDestinoGeradores({})
  }

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
    pendentes.forEach(item => {
      const s = statusItens[item.id] || 'aguardando'
      totais[s] = (totais[s] || 0) + 1
    })
    return totais
  }, [pendentes, statusItens])

  // Com tudo lançado individualmente, ainda pode restar o fechamento (ordens,
  // geradores, evento) — por isso a confirmação vale mesmo com a lista vazia,
  // desde que exista gerador ou item para tratar.
  const podeConcluir = (pendentes.length > 0 || geradoresDoEvento.length > 0)
    && geradoresValidos
    && pendentes.every(item => {
      const s = statusItens[item.id]
      if (!s || s === 'aguardando') return false
      if ((s === 'problema' || s === 'cortado') && !descricoes[item.id]?.trim()) return false
      return true
    })

  // Lança UM item, sem fechar nada: os outros continuam no evento. Parcial não
  // entra aqui — parcial é "ainda falta voltar", então o item segue pendente.
  async function lancarItem(item) {
    const s = statusItens[item.id]
    if (!s || s === 'aguardando' || s === 'parcial') return
    if ((s === 'problema' || s === 'cortado') && !descricoes[item.id]?.trim()) return
    setLancandoItem(item.id)
    setErro('')
    try {
      await runTransaction(db, async (tx) => {
        const matRef = doc(db, 'materiais', item.id)
        const snap = await tx.get(matRef)
        if (!snap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
        if (snap.data().status !== 'em_evento') throw new Error(`${item.nome} já não está mais no evento.`)
        // Registro próprio em devolucoes, com a marca de parcial — o relatório
        // continua enxergando tudo.
        tx.set(doc(collection(db, 'devolucoes')), {
          eventoId: eventoSelecionado.id,
          eventoNome: eventoSelecionado.nome,
          parcial: true,
          itens: [{ ...item, statusDevolucao: s, descricao: descricoes[item.id] || null }],
          operadorUid: uid,
          operadorNome: nome,
          criadoEm: serverTimestamp(),
        })
        const patch = patchDevolucaoEvento(snap.data(), item.quantidade || 1, s)
        if (patch) tx.update(matRef, patch)
      })
      // O listener de materiais tira o item da lista; limpa o estado dele.
      setStatusItens(prev => { const p = { ...prev }; delete p[item.id]; return p })
      setDescricoes(prev => { const p = { ...prev }; delete p[item.id]; return p })
    } catch (err) {
      setErro(err.message || 'Erro ao lançar o item.')
    } finally {
      setLancandoItem(null)
    }
  }

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
        const lidos = {}
        for (const item of pendentes) {
          if (materialPorQuantidade(item)) continue
          const matRef = doc(db, 'materiais', item.id)
          const snap = await tx.get(matRef)
          if (!snap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
          statusAtualMat[item.id] = snap.data().status
          lidos[item.id] = snap.data()
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
        // Item lançado individualmente já tem o próprio registro em devolucoes
        // (parcial: true) — aqui entram só os que restaram. Se todos foram
        // lançados um a um, a confirmação vira só o fechamento e não cria doc.
        if (pendentes.length > 0) {
          const devRef = doc(collection(db, 'devolucoes'))
          tx.set(devRef, {
            eventoId: eventoSelecionado.id,
            eventoNome: eventoSelecionado.nome,
            itens: pendentes.map(item => ({
              ...item,
              statusDevolucao: statusItens[item.id] || 'aguardando',
              descricao: descricoes[item.id] || null,
            })),
            operadorUid: uid,
            operadorNome: nome,
            criadoEm: serverTimestamp(),
          })
        }

        for (const item of pendentes) {
          // Consumível por quantidade: não prende estoque, nada a alterar aqui.
          if (materialPorQuantidade(item)) continue
          const dados = lidos[item.id]
          const s = statusItens[item.id] || 'aguardando'
          // ⚠️ Material CONTADO (alambrado) nunca fica "em_evento" — ele só
          // perdeu quantidade. Checar o status aqui o faria ser pulado calado,
          // e a quantidade nunca voltaria para a prateleira.
          if (!materialContado(dados)) {
            // Só devolve o que ainda está no evento. Se já voltou por outro
            // fluxo, segue no registro sem mexer no estoque de novo.
            if (statusAtualMat[item.id] !== 'em_evento') continue
          }
          const patch = patchDevolucaoEvento(dados, item.quantidade || 1, s)
          if (patch) tx.update(doc(db, 'materiais', item.id), patch)
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
              placeholder="Buscar por evento ou material (ex: Cabo 4x50)..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input mb-3"
            />
            {eventosComOrdem.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum evento com material em campo.</p>
            ) : eventosFiltrados.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">
                Nenhum evento nem material em campo com esse texto.
              </p>
            ) : (
              <div className="space-y-2">
                {eventosFiltrados
                  .map(({ evento: evt, itensBatidos }) => (
                    <button
                      key={evt.id}
                      onClick={() => setEventoSelecionado(evt)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-brand-red hover:bg-red-50/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors truncate">{evt.nome}</p>
                            {evt.tipo === 'locacao_mensal' && (
                              <span className="badge bg-purple-100 text-purple-700 flex-shrink-0">Locação</span>
                            )}
                            {evt.tipo === 'sublocacao' && (
                              <span className="badge bg-teal-100 text-teal-700 flex-shrink-0">Sublocação</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {evt.local} • {formatarData(evt.data)}
                            {evt.retiradoPor ? ` • retirado por ${evt.retiradoPor}` : ''}
                          </p>
                          {itensBatidos.length > 0 && (
                            // O evento entrou na lista por causa do material buscado:
                            // mostra qual, senão o resultado parece não ter a ver.
                            <p className="text-xs text-brand-red mt-0.5 truncate">
                              tem aqui: {itensBatidos.slice(0, 2).map(i => i.nome || i.codigo).join(', ')}
                              {itensBatidos.length > 2 ? ` +${itensBatidos.length - 2}` : ''}
                            </p>
                          )}
                        </div>
                        <span className={`badge ${statusEventoCor(evt.status)} flex-shrink-0`}>
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {/* Mesma seta de voltar das outras telas de detalhe (ex: GG). */}
                <button
                  onClick={voltarParaLista}
                  className="btn-ghost px-2 flex-shrink-0"
                  aria-label="Voltar para a lista de eventos"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <p className="font-semibold text-brand-black truncate">{eventoSelecionado.nome}</p>
                  <p className="text-xs text-gray-500">{pendentes.length} {pendentes.length === 1 ? 'item' : 'itens'} para devolver</p>
                </div>
              </div>
              <button
                onClick={voltarParaLista}
                className="text-sm text-brand-red hover:underline flex-shrink-0"
              >
                Trocar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {pendentes.map(item => (
              <ItemDevolucao
                key={item.id}
                item={item}
                statusAtual={statusItens[item.id]}
                descricao={descricoes[item.id]}
                onStatus={handleStatus}
                onDescricao={handleDescricao}
                onLancar={itemLancavelSozinho(item, materiaisMap) ? () => lancarItem(item) : null}
                lancando={lancandoItem === item.id}
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
            ) : (pendentes.length > 0
              ? `Confirmar Devolução (${pendentes.length} ${pendentes.length === 1 ? 'item' : 'itens'})`
              : 'Encerrar devolução do evento')}
          </button>
          {!podeConcluir && pendentes.length > 0 && (
            <p className="text-xs text-gray-400 text-center">Marque o status de todos os itens para continuar.</p>
          )}
        </div>
      )}
    </div>
  )
}
