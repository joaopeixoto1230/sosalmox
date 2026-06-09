import { useState, useMemo } from 'react'
import { collection, query, where, getDocs, writeBatch, deleteDoc, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, statusOsLabel, statusOsCor, statusEventoCor, statusEventoLabel } from '../../utils/formatters'

const ABAS = ['Saídas', 'Devoluções', 'Condições', 'Manutenções', 'Filtros', 'Estoque', 'Eventos']

const STATUS_CONDICAO = [
  { value: null, label: 'Todos', ativo: 'bg-brand-black text-white', inativo: 'bg-white border-gray-200 text-gray-600' },
  { value: 'ok', label: 'OK', ativo: 'bg-green-500 text-white border-green-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600' },
  { value: 'problema', label: 'Com problema', ativo: 'bg-orange-500 text-white border-orange-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600' },
  { value: 'cortado', label: 'Cortado', ativo: 'bg-gray-700 text-white border-gray-700', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-gray-500 hover:text-gray-700' },
  { value: 'perdido', label: 'Perdido', ativo: 'bg-red-500 text-white border-red-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600' },
]

const COR_CONDICAO = {
  ok: 'bg-green-100 text-green-700',
  problema: 'bg-orange-100 text-orange-700',
  cortado: 'bg-gray-200 text-gray-700',
  perdido: 'bg-red-100 text-red-700',
}

function dataFiltro(item, campo, de, ate) {
  if (!de && !ate) return true
  const d = item[campo]?.toDate ? item[campo].toDate() : item[campo] ? new Date(item[campo]) : null
  if (!d) return false
  if (de && d < new Date(de)) return false
  if (ate && d > new Date(ate + 'T23:59:59')) return false
  return true
}

export default function Relatorios() {
  const [aba, setAba] = useState('Saídas')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [excluindoEvento, setExcluindoEvento] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [excluindoOrdem, setExcluindoOrdem] = useState(null)
  const [excluindoOrd, setExcluindoOrd] = useState(false)
  const [excluindoDevolucao, setExcluindoDevolucao] = useState(null)
  const [excluindoDev, setExcluindoDev] = useState(false)
  const [filtroCondicao, setFiltroCondicao] = useState(null)

  const { dados: ordens } = useCollection('ordens_saida')
  const { dados: devolucoes } = useCollection('devolucoes')
  const { dados: os } = useCollection('ordens_servico')
  const { dados: baixasFiltro } = useCollection('baixas_filtro')
  const { dados: materiais } = useCollection('materiais')
  const { dados: filtros } = useCollection('filtros')
  const { dados: eventos } = useCollection('eventos')

  const ordensFiltradas = useMemo(() =>
    ordens.filter(o => dataFiltro(o, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.()?.getTime() || 0) - (a.criadoEm?.toDate?.()?.getTime() || 0)),
    [ordens, de, ate])

  const devolucoesFiltradas = useMemo(() =>
    devolucoes.filter(d => dataFiltro(d, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.()?.getTime() || 0) - (a.criadoEm?.toDate?.()?.getTime() || 0)),
    [devolucoes, de, ate])

  const itensRetornados = useMemo(() => {
    const todos = devolucoesFiltradas.flatMap(d =>
      (d.itens || []).map(item => ({
        ...item,
        eventoNome: d.eventoNome,
        operadorNome: d.operadorNome,
        data: d.criadoEm,
      }))
    )
    if (!filtroCondicao) return todos
    return todos.filter(i => i.statusDevolucao === filtroCondicao)
  }, [devolucoesFiltradas, filtroCondicao])

  const statsCondicao = useMemo(() => {
    const todos = devolucoesFiltradas.flatMap(d => d.itens || [])
    return {
      ok: todos.filter(i => i.statusDevolucao === 'ok').length,
      problema: todos.filter(i => i.statusDevolucao === 'problema').length,
      cortado: todos.filter(i => i.statusDevolucao === 'cortado').length,
      perdido: todos.filter(i => i.statusDevolucao === 'perdido').length,
    }
  }, [devolucoesFiltradas])

  const osFiltradas = useMemo(() =>
    os.filter(o => dataFiltro(o, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.()?.getTime() || 0) - (a.criadoEm?.toDate?.()?.getTime() || 0)),
    [os, de, ate])

  const baixasFiltradas = useMemo(() =>
    baixasFiltro.filter(b => dataFiltro(b, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.()?.getTime() || 0) - (a.criadoEm?.toDate?.()?.getTime() || 0)),
    [baixasFiltro, de, ate])

  const estoqueBaixo = useMemo(() =>
    materiais.filter(m => m.estoqueMin > 0 && m.estoqueAtual <= m.estoqueMin)
      .sort((a, b) => (a.estoqueAtual / (a.estoqueMin || 1)) - (b.estoqueAtual / (b.estoqueMin || 1))),
    [materiais])

  const filtrosBaixo = useMemo(() =>
    filtros.filter(f => f.ativo !== false && f.estoqueMin > 0 && f.quantidadeAtual <= f.estoqueMin)
      .sort((a, b) => (a.quantidadeAtual / (a.estoqueMin || 1)) - (b.quantidadeAtual / (b.estoqueMin || 1))),
    [filtros])

  const eventosFiltrados = useMemo(() =>
    eventos
      .filter(e => dataFiltro(e, 'criadoEm', de, ate))
      .sort((a, b) => new Date(b.data) - new Date(a.data)),
    [eventos, de, ate])

  async function confirmarExcluirEvento() {
    if (!excluindoEvento) return
    setExcluindo(true)
    try {
      const batch = writeBatch(db)

      const materiaisSnap = await getDocs(query(collection(db, 'materiais'), where('eventoAtual', '==', excluindoEvento.id)))
      materiaisSnap.forEach(d => batch.update(d.ref, { status: 'disponivel', estoqueAtual: 1, eventoAtual: null }))

      const geradoresSnap = await getDocs(query(collection(db, 'geradores'), where('eventoAtual', '==', excluindoEvento.id)))
      geradoresSnap.forEach(d => batch.update(d.ref, { status: 'disponivel', eventoAtual: null }))

      const ordensSnap = await getDocs(query(collection(db, 'ordens_saida'), where('eventoId', '==', excluindoEvento.id)))
      ordensSnap.forEach(d => batch.delete(d.ref))

      batch.delete(doc(db, 'eventos', excluindoEvento.id))
      await batch.commit()
      setExcluindoEvento(null)
    } catch (e) {
      console.error(e)
    } finally {
      setExcluindo(false)
    }
  }

  async function confirmarExcluirDevolucao() {
    if (!excluindoDevolucao) return
    setExcluindoDev(true)
    try {
      await deleteDoc(doc(db, 'devolucoes', excluindoDevolucao.id))
      setExcluindoDevolucao(null)
    } catch (e) {
      console.error(e)
    } finally {
      setExcluindoDev(false)
    }
  }

  async function confirmarExcluirOrdem() {
    if (!excluindoOrdem) return
    setExcluindoOrd(true)
    try {
      await deleteDoc(doc(db, 'ordens_saida', excluindoOrdem.id))

      for (const item of excluindoOrdem.itens || []) {
        if (item.id) {
          updateDoc(doc(db, 'materiais', item.id), { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
            .catch(() => {})
        }
      }

      setExcluindoOrdem(null)
    } catch (e) {
      console.error(e)
    } finally {
      setExcluindoOrd(false)
    }
  }

  const devStats = useMemo(() => {
    const itens = devolucoesFiltradas.flatMap(d => d.itens || [])
    return {
      ok: itens.filter(i => i.statusDevolucao === 'ok').length,
      problema: itens.filter(i => i.statusDevolucao === 'problema').length,
      perdido: itens.filter(i => i.statusDevolucao === 'perdido').length,
      cortado: itens.filter(i => i.statusDevolucao === 'cortado').length,
    }
  }, [devolucoesFiltradas])

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:space-y-4">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Visão operacional por período.</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      <div className="flex gap-3 flex-wrap print:hidden">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {ABAS.map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${aba === a ? 'bg-white shadow-sm text-brand-black' : 'text-gray-500 hover:text-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input text-sm" value={de} onChange={e => setDe(e.target.value)} />
          <span className="text-gray-400 text-sm">até</span>
          <input type="date" className="input text-sm" value={ate} onChange={e => setAte(e.target.value)} />
          {(de || ate) && (
            <button onClick={() => { setDe(''); setAte('') }} className="text-xs text-gray-400 hover:text-gray-600">
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* SAÍDAS */}
      {aba === 'Saídas' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-black">Ordens de Material</h2>
            <span className="text-sm text-gray-400">{ordensFiltradas.length} registros</span>
          </div>
          {ordensFiltradas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhuma saída no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Ordem</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Evento</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Operador</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Data</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs text-brand-red">{o.numero || o.id.slice(0, 6).toUpperCase()}</td>
                      <td className="py-2 font-medium text-brand-black">{o.eventoNome || '—'}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell">{o.operadorNome || '—'}</td>
                      <td className="py-2">
                        <span className={`badge ${o.status === 'devolvida' ? 'bg-green-100 text-green-700' : o.status === 'cancelada' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                          {o.status === 'devolvida' ? 'Devolvida' : o.status === 'cancelada' ? 'Cancelada' : 'Em aberto'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{formatarData(o.criadoEm)}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setExcluindoOrdem(o)}
                          className="p-1.5 text-gray-300 hover:text-brand-red hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DEVOLUÇÕES */}
      {aba === 'Devoluções' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['OK', devStats.ok, 'text-green-600'], ['Com problema', devStats.problema, 'text-orange-600'], ['Perdido', devStats.perdido, 'text-red-600'], ['Cortado', devStats.cortado, 'text-gray-600']].map(([l, v, cls]) => (
              <div key={l} className="card text-center py-3">
                <p className={`text-2xl font-bold ${cls}`}>{v}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-brand-black">Registros de Devolução</h2>
              <span className="text-sm text-gray-400">{devolucoesFiltradas.length} registros</span>
            </div>
            {devolucoesFiltradas.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhuma devolução no período.</p>
            ) : (
              <div className="space-y-3">
                {devolucoesFiltradas.map(d => {
                  const itens = d.itens || []
                  const problemas = itens.filter(i => ['problema', 'perdido', 'cortado'].includes(i.statusDevolucao))
                  return (
                    <div key={d.id} className={`border rounded-xl p-4 ${problemas.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-brand-black text-sm">{d.eventoNome || '—'}</p>
                          <p className="text-xs text-gray-400">{d.operadorNome} · {formatarData(d.criadoEm)}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{itens.filter(i => i.statusDevolucao === 'ok').length} OK</span>
                          {problemas.length > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{problemas.length} problema{problemas.length > 1 ? 's' : ''}</span>}
                          <button
                            onClick={() => setExcluindoDevolucao(d)}
                            className="p-1 text-gray-300 hover:text-brand-red hover:bg-red-50 rounded-lg transition-colors ml-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {problemas.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {problemas.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.statusDevolucao === 'perdido' ? 'bg-red-500' : item.statusDevolucao === 'problema' ? 'bg-orange-500' : 'bg-gray-400'}`} />
                              <span className="font-medium">{item.nome}</span>
                              <span className="text-gray-400">— {item.statusDevolucao}</span>
                              {item.descricao && <span className="text-gray-400 truncate">({item.descricao})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONDIÇÕES */}
      {aba === 'Condições' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'OK', valor: statsCondicao.ok, cor: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Com problema', valor: statsCondicao.problema, cor: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Cortado', valor: statsCondicao.cortado, cor: 'text-gray-700', bg: 'bg-gray-100' },
              { label: 'Perdido', valor: statsCondicao.perdido, cor: 'text-red-600', bg: 'bg-red-50' },
            ].map(s => (
              <div key={s.label} className={`card ${s.bg} border-0 text-center py-3`}>
                <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_CONDICAO.map(op => (
              <button
                key={op.label}
                onClick={() => setFiltroCondicao(op.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors
                  ${filtroCondicao === op.value ? op.ativo : op.inativo}`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-brand-black">Itens devolvidos</h2>
              <span className="text-sm text-gray-400">{itensRetornados.length} itens</span>
            </div>
            {itensRetornados.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhum item encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Material</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Código</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Condição</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Evento</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Operador</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensRetornados.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-medium text-brand-black">{item.nome || '—'}</td>
                        <td className="py-2 text-gray-400 font-mono text-xs hidden sm:table-cell">{item.codigo || '—'}</td>
                        <td className="py-2">
                          <div>
                            <span className={`badge ${COR_CONDICAO[item.statusDevolucao] || 'bg-gray-100 text-gray-600'}`}>
                              {item.statusDevolucao === 'ok' ? 'OK' : item.statusDevolucao === 'problema' ? 'Problema' : item.statusDevolucao === 'cortado' ? 'Cortado' : item.statusDevolucao === 'perdido' ? 'Perdido' : '—'}
                            </span>
                            {item.descricao && (
                              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{item.descricao}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-gray-600 hidden sm:table-cell">{item.eventoNome || '—'}</td>
                        <td className="py-2 text-gray-500 hidden sm:table-cell">{item.operadorNome || '—'}</td>
                        <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{formatarData(item.data)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUTENÇÕES */}
      {aba === 'Manutenções' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-black">Ordens de Serviço</h2>
            <span className="text-sm text-gray-400">{osFiltradas.length} registros</span>
          </div>
          {osFiltradas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhuma OS no período.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">OS</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Equipamento</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Tipo</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Mecânico</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osFiltradas.map(o => (
                      <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs text-brand-red">{o.numero || '—'}</td>
                        <td className="py-2 font-medium text-brand-black">{o.equipamentoLabel || '—'}</td>
                        <td className="py-2 text-gray-500 hidden sm:table-cell capitalize">{o.tipo || '—'}</td>
                        <td className="py-2 text-gray-500 hidden sm:table-cell">{o.mecanicoNome || '—'}</td>
                        <td className="py-2"><span className={`badge ${statusOsCor(o.status)}`}>{statusOsLabel(o.status)}</span></td>
                        <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{formatarData(o.criadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
                {[['Pendentes', osFiltradas.filter(o => o.status === 'pendente').length, 'text-yellow-600'],
                  ['Em andamento', osFiltradas.filter(o => o.status === 'em_andamento').length, 'text-blue-600'],
                  ['Concluídas', osFiltradas.filter(o => o.status === 'concluida').length, 'text-green-600'],
                ].map(([l, v, cls]) => (
                  <div key={l}>
                    <p className={`text-xl font-bold ${cls}`}>{v}</p>
                    <p className="text-xs text-gray-400">{l}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* FILTROS */}
      {aba === 'Filtros' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-brand-black">Baixas de Filtros</h2>
              <span className="text-sm text-gray-400">{baixasFiltradas.length} registros</span>
            </div>
            {baixasFiltradas.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhuma baixa no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Filtro</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Qtd</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Motivo</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Operador</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baixasFiltradas.map(b => (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-medium text-brand-black">{b.filtroNome || '—'}</td>
                        <td className="py-2 text-gray-600">{b.quantidade}</td>
                        <td className="py-2 text-gray-500 hidden sm:table-cell">{b.motivo || '—'}</td>
                        <td className="py-2 text-gray-500 hidden sm:table-cell">{b.operadorNome || '—'}</td>
                        <td className="py-2 text-gray-400 text-xs">{formatarData(b.criadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {filtrosBaixo.length > 0 && (
            <div className="card border-l-4 border-yellow-400">
              <h3 className="font-semibold text-brand-black mb-3">Filtros abaixo do mínimo agora</h3>
              <div className="space-y-2">
                {filtrosBaixo.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{f.nome} <span className="text-gray-400 text-xs">({f.potenciaGG})</span></span>
                    <span className={`font-semibold ${f.quantidadeAtual <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {f.quantidadeAtual} / min {f.estoqueMin}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EVENTOS */}
      {aba === 'Eventos' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-black">Eventos</h2>
            <span className="text-sm text-gray-400">{eventosFiltrados.length} registros</span>
          </div>
          {eventosFiltrados.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhum evento no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Nome</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Local</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Data</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {eventosFiltrados.map(e => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-brand-black">{e.nome}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell">{e.local || '—'}</td>
                      <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{e.data ? new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-2">
                        <span className={`badge ${statusEventoCor(e.status)}`}>{statusEventoLabel(e.status)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setExcluindoEvento(e)}
                          className="p-1.5 text-gray-300 hover:text-brand-red hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir evento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {excluindoDevolucao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brand-black">Apagar devolução</p>
                <p className="text-sm text-gray-500">O registro histórico será removido.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <strong>{excluindoDevolucao.eventoNome || '—'}</strong> · {excluindoDevolucao.operadorNome} · {formatarData(excluindoDevolucao.criadoEm)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setExcluindoDevolucao(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={confirmarExcluirDevolucao}
                disabled={excluindoDev}
                className="flex-1 px-4 py-2 bg-brand-red text-white rounded-xl font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {excluindoDev ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluindoOrdem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brand-black">Apagar saída</p>
                <p className="text-sm text-gray-500">Os materiais da ordem voltam ao estoque.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <strong>Ordem {excluindoOrdem.numero || excluindoOrdem.id.slice(0, 6).toUpperCase()}</strong> — {excluindoOrdem.eventoNome || '—'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setExcluindoOrdem(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={confirmarExcluirOrdem}
                disabled={excluindoOrd}
                className="flex-1 px-4 py-2 bg-brand-red text-white rounded-xl font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {excluindoOrd ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluindoEvento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brand-black">Excluir evento</p>
                <p className="text-sm text-gray-500">Remove materiais, geradores e ordens vinculadas.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <strong>{excluindoEvento.nome}</strong> — {excluindoEvento.local}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setExcluindoEvento(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={confirmarExcluirEvento}
                disabled={excluindo}
                className="flex-1 px-4 py-2 bg-brand-red text-white rounded-xl font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESTOQUE */}
      {aba === 'Estoque' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Total de itens', materiais.length, 'text-brand-black'],
              ['Disponíveis', materiais.filter(m => m.status === 'disponivel').length, 'text-green-600'],
              ['Em campo', materiais.filter(m => m.status === 'em_evento').length, 'text-yellow-600'],
              ['Estoque baixo', estoqueBaixo.length, estoqueBaixo.length > 0 ? 'text-red-600' : 'text-green-600'],
            ].map(([l, v, cls]) => (
              <div key={l} className="card text-center">
                <p className={`text-2xl font-bold ${cls}`}>{v}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          {estoqueBaixo.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-brand-black mb-4">Itens com estoque baixo</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Categoria</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Atual</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueBaixo.map(m => (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium text-brand-black">{m.nome}</td>
                        <td className="py-2 text-gray-500">{m.categoria || '—'}</td>
                        <td className="py-2"><span className={`font-semibold ${m.estoqueAtual <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>{m.estoqueAtual}</span></td>
                        <td className="py-2 text-gray-500">{m.estoqueMin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="card">
            <h2 className="font-semibold text-brand-black mb-4">Todos os materiais</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Categoria</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Código</th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-brand-black">{m.nome}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell">{m.categoria || '—'}</td>
                      <td className="py-2">
                        <span className={`badge ${m.status === 'disponivel' ? 'bg-green-100 text-green-700' : m.status === 'em_evento' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {m.status === 'disponivel' ? 'Disponível' : m.status === 'em_evento' ? 'Em evento' : m.status || '—'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs hidden sm:table-cell font-mono">{m.codigo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
