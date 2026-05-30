import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, formatarDataHora, statusEventoLabel, statusOsLabel, statusOsCor } from '../../utils/formatters'

const ABAS = ['Saídas', 'Manutenções', 'Filtros', 'Estoque']

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

  const { dados: ordens } = useCollection('ordens_material')
  const { dados: os } = useCollection('ordens_servico')
  const { dados: baixasFiltro } = useCollection('baixas_filtro')
  const { dados: entradasFiltro } = useCollection('entradas_filtro')
  const { dados: materiais } = useCollection('materiais')
  const { dados: filtros } = useCollection('filtros')

  const ordensFiltradas = useMemo(() =>
    ordens.filter(o => dataFiltro(o, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.() || 0) - (a.criadoEm?.toDate?.() || 0)),
    [ordens, de, ate])

  const osFiltradas = useMemo(() =>
    os.filter(o => dataFiltro(o, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.() || 0) - (a.criadoEm?.toDate?.() || 0)),
    [os, de, ate])

  const baixasFiltradas = useMemo(() =>
    baixasFiltro.filter(b => dataFiltro(b, 'criadoEm', de, ate))
      .sort((a, b) => (b.criadoEm?.toDate?.() || 0) - (a.criadoEm?.toDate?.() || 0)),
    [baixasFiltro, de, ate])

  const estoqueBaixo = useMemo(() =>
    materiais.filter(m => m.estoqueMin > 0 && m.estoqueAtual <= m.estoqueMin)
      .sort((a, b) => (a.estoqueAtual / (a.estoqueMin || 1)) - (b.estoqueAtual / (b.estoqueMin || 1))),
    [materiais])

  const filtrosBaixo = useMemo(() =>
    filtros.filter(f => f.ativo !== false && f.estoqueMin > 0 && f.quantidadeAtual <= f.estoqueMin)
      .sort((a, b) => (a.quantidadeAtual / (a.estoqueMin || 1)) - (b.quantidadeAtual / (b.estoqueMin || 1))),
    [filtros])

  function imprimir() { window.print() }

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:space-y-4">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Visão operacional por período.</p>
        </div>
        <button onClick={imprimir} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      <div className="flex gap-3 flex-wrap print:hidden">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {ABAS.map(a => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${aba === a ? 'bg-white shadow-sm text-brand-black' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input type="date" className="input text-sm" value={de} onChange={e => setDe(e.target.value)} />
          <span className="text-gray-400 text-sm">até</span>
          <input type="date" className="input text-sm" value={ate} onChange={e => setAte(e.target.value)} />
          {(de || ate) && (
            <button onClick={() => { setDe(''); setAte('') }} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
              Limpar
            </button>
          )}
        </div>
      </div>

      {aba === 'Saídas' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-black">Ordens de Material</h2>
            <span className="text-sm text-gray-400">{ordensFiltradas.length} registros</span>
          </div>
          {ordensFiltradas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhuma ordem no período selecionado.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs text-brand-red">{o.numero || o.id.slice(0, 6).toUpperCase()}</td>
                      <td className="py-2 font-medium text-brand-black">{o.eventoNome || '—'}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell">{o.operadorNome || '—'}</td>
                      <td className="py-2">
                        <span className={`badge ${o.status === 'concluida' ? 'bg-green-100 text-green-700' : o.status === 'cancelada' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                          {o.status === 'concluida' ? 'Concluída' : o.status === 'cancelada' ? 'Cancelada' : 'Em aberto'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{formatarData(o.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'Manutenções' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-black">Ordens de Serviço</h2>
            <span className="text-sm text-gray-400">{osFiltradas.length} registros</span>
          </div>
          {osFiltradas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhuma OS no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">OS</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Equipamento</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Tipo</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Mecânico</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Abertura</th>
                  </tr>
                </thead>
                <tbody>
                  {osFiltradas.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs text-brand-red">{o.numero || '—'}</td>
                      <td className="py-2 font-medium text-brand-black">{o.equipamentoLabel || '—'}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell capitalize">{o.tipo || '—'}</td>
                      <td className="py-2 text-gray-500 hidden sm:table-cell">{o.mecanicoNome || '—'}</td>
                      <td className="py-2">
                        <span className={`badge ${statusOsCor(o.status)}`}>{statusOsLabel(o.status)}</span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{formatarData(o.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        </div>
      )}

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
              <h3 className="font-semibold text-brand-black mb-3">Filtros abaixo do mínimo</h3>
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
                        <td className="py-2">
                          <span className={`font-semibold ${m.estoqueAtual <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {m.estoqueAtual}
                          </span>
                        </td>
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
