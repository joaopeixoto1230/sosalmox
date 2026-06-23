import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData } from '../../utils/formatters'
import Fornecedores from './Fornecedores'

const STATUS_COR = {
  pendente: 'bg-yellow-100 text-yellow-700',
  em_cotacao: 'bg-blue-100 text-blue-700',
  comprado: 'bg-purple-100 text-purple-700',
  entregue: 'bg-green-100 text-green-700',
}
const STATUS_LABEL = {
  pendente: 'Pendente',
  em_cotacao: 'Em Cotação',
  comprado: 'Comprado',
  entregue: 'Entregue',
}

// data que conta para o gasto: quando foi entregue/comprada (entregueEm),
// caindo para criadoEm só se não houver data de entrega.
function dataEntregaDe(s) {
  const v = s.entregueEm || s.criadoEm
  return v?.toDate ? v.toDate() : new Date(v || 0)
}
// valor da compra: usa o total gravado na entrega; senão calcula preço × quantidade.
function valorCompra(s) {
  if (s.total != null) return s.total
  return (s.precoUnitario || 0) * (s.quantidadeEntregue || s.quantidadeSugerida || 1)
}
function fmtBRL(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function porDataDesc(lista) {
  return [...lista].sort((a, b) => {
    const da = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0)
    const db2 = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0)
    return db2 - da
  })
}

export default function ComprasDashboard() {
  const [aba, setAba] = useState('visao')
  const [historico, setHistorico] = useState(null)
  const navigate = useNavigate()
  const { dados: solicitacoes } = useCollection('solicitacoes_compra')
  const { dados: fornecedores } = useCollection('fornecedores')

  const stats = useMemo(() => {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const mesAnteriorInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const mesAnteriorFim = new Date(agora.getFullYear(), agora.getMonth(), 0)

    const entreguesMes = solicitacoes.filter(s => s.status === 'entregue' && dataEntregaDe(s) >= inicioMes)
    const entreguesMesAnterior = solicitacoes.filter(s => {
      if (s.status !== 'entregue') return false
      const d = dataEntregaDe(s)
      return d >= mesAnteriorInicio && d <= mesAnteriorFim
    })

    const gastoMes = entreguesMes.reduce((acc, s) => acc + valorCompra(s), 0)
    const gastoAnterior = entreguesMesAnterior.reduce((acc, s) => acc + valorCompra(s), 0)

    const gastos6Meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1)
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const total = solicitacoes
        .filter(s => {
          if (s.status !== 'entregue') return false
          const sd = dataEntregaDe(s)
          return sd >= d && sd <= fim
        })
        .reduce((acc, s) => acc + valorCompra(s), 0)
      return {
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        total,
      }
    })

    const statusDist = [
      { key: 'pendente',   label: 'Pendente',    cor: '#FBBF24', count: solicitacoes.filter(s => s.status === 'pendente').length },
      { key: 'em_cotacao', label: 'Em Cotação',  cor: '#3B82F6', count: solicitacoes.filter(s => s.status === 'em_cotacao').length },
      { key: 'comprado',   label: 'Comprado',    cor: '#8B5CF6', count: solicitacoes.filter(s => s.status === 'comprado').length },
      { key: 'entregue',   label: 'Entregue',    cor: '#22C55E', count: solicitacoes.filter(s => s.status === 'entregue').length },
    ]

    // gasto por tipo no mês (entregues), do maior para o menor
    const mapaTipo = {}
    for (const s of entreguesMes) {
      const t = (s.tipo || 'Outro').trim() || 'Outro'
      mapaTipo[t] = (mapaTipo[t] || 0) + valorCompra(s)
    }
    const gastoPorTipo = Object.entries(mapaTipo)
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total)

    return {
      pendentes: solicitacoes.filter(s => s.status === 'pendente').length,
      criticos: solicitacoes.filter(s => s.status === 'pendente' && s.quantidadeAtual <= 0).length,
      fornecedoresAtivos: fornecedores.filter(f => f.ativo !== false).length,
      gastoMes,
      gastoAnterior,
      variacaoGasto: gastoAnterior > 0 ? ((gastoMes - gastoAnterior) / gastoAnterior * 100).toFixed(0) : null,
      gastos6Meses,
      statusDist,
      gastoPorTipo,
      total: solicitacoes.length,
      recentes: porDataDesc(solicitacoes).slice(0, 8),
      // listas para o histórico ao clicar nos cards
      pendentesList: [...solicitacoes.filter(s => s.status === 'pendente')].sort((a, b) => {
        const ca = a.quantidadeAtual <= 0 ? 0 : 1
        const cb = b.quantidadeAtual <= 0 ? 0 : 1
        if (ca !== cb) return ca - cb
        return dataEntregaDe(b) - dataEntregaDe(a)
      }),
      entreguesMesList: [...entreguesMes].sort((a, b) => dataEntregaDe(b) - dataEntregaDe(a)),
      todasList: porDataDesc(solicitacoes),
    }
  }, [solicitacoes, fornecedores])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Compras</h1>
          <p className="text-gray-500 text-sm mt-1">Painel de abastecimento e fornecedores.</p>
        </div>
        <Link to="/solicitacoes" className="btn-primary flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ver fila completa
        </Link>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['visao', 'Visão Geral'], ['fornecedores', 'Fornecedores']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${aba === id ? 'bg-white shadow-sm text-brand-black' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'visao' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setHistorico({ titulo: 'Solicitações pendentes', itens: stats.pendentesList, mostrarValor: false })}
              className="card text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-xs text-gray-500 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-brand-black">{stats.pendentes}</p>
              {stats.criticos > 0 && (
                <p className="text-xs text-red-600 mt-1">{stats.criticos} críticos (zerado)</p>
              )}
            </button>
            <button
              onClick={() => setAba('fornecedores')}
              className="card text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-xs text-gray-500 mb-1">Fornecedores ativos</p>
              <p className="text-2xl font-bold text-brand-black">{stats.fornecedoresAtivos}</p>
              <p className="text-xs text-brand-red mt-1">ver fornecedores →</p>
            </button>
            <button
              onClick={() => setHistorico({ titulo: 'Compras deste mês', itens: stats.entreguesMesList, mostrarValor: true })}
              className="card text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-xs text-gray-500 mb-1">Gasto este mês</p>
              <p className="text-2xl font-bold text-brand-black">
                {stats.gastoMes > 0 ? fmtBRL(stats.gastoMes) : '—'}
              </p>
              {stats.variacaoGasto !== null && stats.gastoMes > 0 && (
                <p className={`text-xs mt-1 ${Number(stats.variacaoGasto) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {Number(stats.variacaoGasto) > 0 ? '+' : ''}{stats.variacaoGasto}% vs. mês anterior
                </p>
              )}
            </button>
            <button
              onClick={() => setHistorico({ titulo: 'Todas as solicitações', itens: stats.todasList, mostrarValor: true })}
              className="card text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-xs text-gray-500 mb-1">Total de solicitações</p>
              <p className="text-2xl font-bold text-brand-black">{solicitacoes.length}</p>
              <p className="text-xs text-brand-red mt-1">ver histórico →</p>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="font-semibold text-brand-black mb-4">Distribuição por status</h2>
              <GraficoPizza dados={stats.statusDist} total={stats.total} />
            </div>

            {stats.gastos6Meses.some(m => m.total > 0) ? (
              <div className="card">
                <h2 className="font-semibold text-brand-black mb-4">Gasto mensal — últimos 6 meses</h2>
                <GraficoGastos dados={stats.gastos6Meses} />
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center text-center py-6">
                <p className="text-gray-400 text-sm">Nenhuma entrega registrada ainda.</p>
                <p className="text-gray-300 text-xs mt-1">O gráfico de gastos aparecerá aqui após as primeiras compras concluídas.</p>
              </div>
            )}
          </div>

          {stats.gastoPorTipo.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-brand-black mb-4">Gasto por tipo — este mês</h2>
              <div className="space-y-2.5">
                {stats.gastoPorTipo.map(({ tipo, total }) => {
                  const pct = stats.gastoMes > 0 ? (total / stats.gastoMes) * 100 : 0
                  return (
                    <div key={tipo}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 truncate">{tipo}</span>
                        <span className="font-semibold text-brand-black whitespace-nowrap ml-2">{fmtBRL(total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-red rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-brand-black">Solicitações recentes</h2>
              <Link to="/solicitacoes" className="text-brand-red text-sm font-medium hover:underline">
                Ver todas →
              </Link>
            </div>

            {stats.recentes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhuma solicitação de compra ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Nº</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Valor</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell pl-3">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentes.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => navigate('/solicitacoes')}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-2.5 text-gray-400 text-xs font-medium hidden sm:table-cell">{s.numero || '—'}</td>
                        <td className="py-2.5 font-medium text-brand-black">
                          {s.itemNome}
                          {s.potenciaGG && <span className="text-xs text-gray-400 ml-1">({s.potenciaGG})</span>}
                        </td>
                        <td className="py-2.5">
                          <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-gray-600 whitespace-nowrap">
                          {s.status === 'entregue' ? fmtBRL(valorCompra(s)) : '—'}
                        </td>
                        <td className="py-2.5 text-gray-400 text-xs hidden sm:table-cell pl-3">
                          {formatarData(s.criadoEm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {aba === 'fornecedores' && <Fornecedores />}

      {historico && (
        <ModalHistorico
          titulo={historico.titulo}
          itens={historico.itens}
          mostrarValor={historico.mostrarValor}
          onFechar={() => setHistorico(null)}
          onAbrirFila={() => { setHistorico(null); navigate('/solicitacoes') }}
        />
      )}
    </div>
  )
}

function ModalHistorico({ titulo, itens, mostrarValor, onFechar, onAbrirFila }) {
  const totalValor = mostrarValor
    ? itens.filter(s => s.status === 'entregue').reduce((acc, s) => acc + valorCompra(s), 0)
    : 0
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-brand-black">{titulo}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {itens.length} {itens.length === 1 ? 'solicitação' : 'solicitações'}
              {mostrarValor && totalValor > 0 ? ` • ${fmtBRL(totalValor)}` : ''}
            </p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-2">
          {itens.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Nada por aqui.</p>
          ) : (
            itens.map(s => {
              const zerado = s.quantidadeAtual <= 0 && s.status !== 'entregue'
              return (
                <button
                  key={s.id}
                  onClick={onAbrirFila}
                  className="w-full text-left rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      {s.numero && <span className="text-[11px] text-gray-400 font-medium">{s.numero}</span>}
                      <span className="font-semibold text-brand-black text-sm truncate">{s.itemNome}</span>
                      {s.urgente && <span className="badge bg-orange-100 text-orange-700 text-xs">Urgente</span>}
                      {zerado && <span className="badge bg-red-100 text-brand-red text-xs">Zerado</span>}
                    </div>
                    <span className={`badge flex-shrink-0 ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-x-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>Qtd sugerida: {s.quantidadeSugerida}</span>
                    {s.fornecedor && <span>• {s.fornecedor}</span>}
                    {mostrarValor && s.status === 'entregue' && <span className="text-gray-600 font-medium">• {fmtBRL(valorCompra(s))}</span>}
                    <span className="text-gray-300">• {formatarData(s.criadoEm)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={onAbrirFila} className="btn-primary w-full">Abrir fila de solicitações</button>
        </div>
      </div>
    </div>
  )
}

function GraficoPizza({ dados, total }) {
  if (total === 0) {
    return <p className="text-center text-gray-400 text-sm py-8">Nenhuma solicitação ainda.</p>
  }

  let acumulado = 0
  const fatias = dados
    .filter(d => d.count > 0)
    .map(d => {
      const pct = (d.count / total) * 100
      const inicio = acumulado
      acumulado += pct
      return { ...d, pct, inicio, fim: acumulado }
    })

  const gradiente = fatias
    .map(f => `${f.cor} ${f.inicio.toFixed(1)}% ${f.fim.toFixed(1)}%`)
    .join(', ')

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <div
          className="w-full h-full rounded-full"
          style={{ background: `conic-gradient(${gradiente})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="bg-white rounded-full flex flex-col items-center justify-center"
            style={{ width: 60, height: 60 }}
          >
            <span className="text-lg font-bold text-brand-black leading-none">{total}</span>
            <span className="text-[10px] text-gray-400">total</span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {dados.map(d => (
          <div key={d.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.cor }} />
              <span className="text-xs text-gray-600 truncate">{d.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs font-semibold text-brand-black">{d.count}</span>
              {total > 0 && (
                <span className="text-[10px] text-gray-400">
                  {((d.count / total) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GraficoGastos({ dados }) {
  const max = Math.max(...dados.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {dados.map((m, i) => {
        const pct = (m.total / max) * 100
        const isLast = i === dados.length - 1
        return (
          <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500 leading-none">
              {m.total > 0 ? `R$${m.total >= 1000 ? (m.total / 1000).toFixed(1) + 'k' : m.total.toFixed(0)}` : ''}
            </span>
            <div className="w-full relative flex items-end" style={{ height: '80px' }}>
              <div
                className={`w-full rounded-t-md transition-all ${isLast ? 'bg-brand-red' : 'bg-gray-200'}`}
                style={{ height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className={`text-[11px] font-medium capitalize ${isLast ? 'text-brand-red' : 'text-gray-400'}`}>
              {m.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
