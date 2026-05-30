import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
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

export default function ComprasDashboard() {
  const [aba, setAba] = useState('visao')
  const { dados: solicitacoes } = useCollection('solicitacoes_compra')
  const { dados: fornecedores } = useCollection('fornecedores')

  const stats = useMemo(() => {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const mesAnteriorInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const mesAnteriorFim = new Date(agora.getFullYear(), agora.getMonth(), 0)

    const entreguesMes = solicitacoes.filter(s => {
      if (s.status !== 'entregue') return false
      const d = s.criadoEm?.toDate ? s.criadoEm.toDate() : new Date(s.criadoEm)
      return d >= inicioMes
    })
    const entreguesMesAnterior = solicitacoes.filter(s => {
      if (s.status !== 'entregue') return false
      const d = s.criadoEm?.toDate ? s.criadoEm.toDate() : new Date(s.criadoEm)
      return d >= mesAnteriorInicio && d <= mesAnteriorFim
    })

    const gastoMes = entreguesMes.reduce((acc, s) => acc + ((s.precoUnitario || 0) * (s.quantidadeSugerida || 1)), 0)
    const gastoAnterior = entreguesMesAnterior.reduce((acc, s) => acc + ((s.precoUnitario || 0) * (s.quantidadeSugerida || 1)), 0)

    return {
      pendentes: solicitacoes.filter(s => s.status === 'pendente').length,
      criticos: solicitacoes.filter(s => s.status === 'pendente' && s.quantidadeAtual <= 0).length,
      fornecedoresAtivos: fornecedores.filter(f => f.ativo !== false).length,
      gastoMes,
      gastoAnterior,
      variacaoGasto: gastoAnterior > 0 ? ((gastoMes - gastoAnterior) / gastoAnterior * 100).toFixed(0) : null,
      recentes: [...solicitacoes]
        .sort((a, b) => {
          const da = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0)
          const db2 = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0)
          return db2 - da
        })
        .slice(0, 8),
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
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-brand-black">{stats.pendentes}</p>
              {stats.criticos > 0 && (
                <p className="text-xs text-red-600 mt-1">{stats.criticos} críticos (zerado)</p>
              )}
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Fornecedores ativos</p>
              <p className="text-2xl font-bold text-brand-black">{stats.fornecedoresAtivos}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Gasto este mês</p>
              <p className="text-2xl font-bold text-brand-black">
                {stats.gastoMes > 0 ? `R$ ${stats.gastoMes.toLocaleString('pt-BR')}` : '—'}
              </p>
              {stats.variacaoGasto !== null && stats.gastoMes > 0 && (
                <p className={`text-xs mt-1 ${Number(stats.variacaoGasto) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {Number(stats.variacaoGasto) > 0 ? '+' : ''}{stats.variacaoGasto}% vs. mês anterior
                </p>
              )}
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Total de solicitações</p>
              <p className="text-2xl font-bold text-brand-black">{solicitacoes.length}</p>
            </div>
          </div>

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
                      <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Referência</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Qtd sugerida</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentes.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-brand-black">
                          {s.itemNome}
                          {s.potenciaGG && <span className="text-xs text-gray-400 ml-1">({s.potenciaGG})</span>}
                        </td>
                        <td className="py-2.5 text-gray-500 hidden sm:table-cell">{s.referencia || '—'}</td>
                        <td className="py-2.5 text-gray-600">{s.quantidadeSugerida}</td>
                        <td className="py-2.5">
                          <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-400 text-xs hidden sm:table-cell">
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
    </div>
  )
}
