import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import MaterialCard from './MaterialCard'
import NovoMaterialModal from './NovoMaterialModal'

const CATEGORIAS = ['Todos', 'Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

const STATUS_OPCOES = [
  { label: 'Todos', value: null, ativo: 'bg-brand-black text-white', inativo: 'bg-white border-gray-200 text-gray-600' },
  { label: 'Disponível', value: 'disponivel', ativo: 'bg-green-500 text-white border-green-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600' },
  { label: 'Em Evento', value: 'em_evento', ativo: 'bg-yellow-500 text-white border-yellow-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-yellow-400 hover:text-yellow-600' },
  { label: 'Manutenção', value: 'manutencao', ativo: 'bg-blue-500 text-white border-blue-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600' },
  { label: 'Perdido', value: 'perdido', ativo: 'bg-red-500 text-white border-red-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600' },
]

export default function Estoque() {
  const { dados: materiais, carregando } = useCollection('materiais')
  const [categoria, setCategoria] = useState('Todos')
  const [statusFiltro, setStatusFiltro] = useState(null)
  const [busca, setBusca] = useState('')
  const [apenasEstoqueBaixo, setApenasEstoqueBaixo] = useState(false)
  const [novoMaterialAberto, setNovoMaterialAberto] = useState(false)

  const filtrados = useMemo(() => {
    return materiais.filter(m => {
      if (categoria !== 'Todos' && m.categoria !== categoria) return false
      if (statusFiltro && m.status !== statusFiltro) return false
      if (apenasEstoqueBaixo && !(m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0)) return false
      if (busca) {
        const q = busca.toLowerCase()
        return m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q)
      }
      return true
    })
  }, [materiais, categoria, statusFiltro, busca, apenasEstoqueBaixo])

  const stats = useMemo(() => ({
    total: materiais.length,
    disponiveis: materiais.filter(m => m.status === 'disponivel').length,
    emCampo: materiais.filter(m => m.status === 'em_evento').length,
    manutencao: materiais.filter(m => m.status === 'manutencao').length,
    perdido: materiais.filter(m => m.status === 'perdido').length,
    estoqueBaixo: materiais.filter(m => m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0).length,
  }), [materiais])

  const contagemPorStatus = {
    null: stats.total,
    disponivel: stats.disponiveis,
    em_evento: stats.emCampo,
    manutencao: stats.manutencao,
    perdido: stats.perdido,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral de todos os materiais do almoxarifado.</p>
        </div>
        <button onClick={() => setNovoMaterialAberto(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo
        </button>
      </div>

      {novoMaterialAberto && (
        <NovoMaterialModal
          onFechar={() => setNovoMaterialAberto(false)}
          onSalvo={() => setNovoMaterialAberto(false)}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total de Itens', valor: stats.total, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Disponíveis', valor: stats.disponiveis, cor: 'bg-green-50 text-green-700' },
          { label: 'Em Campo', valor: stats.emCampo, cor: 'bg-yellow-50 text-yellow-700' },
          { label: 'Estoque Baixo', valor: stats.estoqueBaixo, cor: stats.estoqueBaixo > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-sm font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input
          type="search"
          placeholder="Buscar por nome ou código..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIAS.map(cat => (
            <button key={cat} onClick={() => setCategoria(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors
                ${categoria === cat ? 'bg-brand-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPCOES.map(op => (
            <button
              key={op.label}
              onClick={() => setStatusFiltro(op.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors
                ${statusFiltro === op.value ? op.ativo : op.inativo}`}
            >
              {op.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                statusFiltro === op.value ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
              }`}>
                {contagemPorStatus[op.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={apenasEstoqueBaixo}
              onChange={e => setApenasEstoqueBaixo(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
            />
            <span className="text-sm text-gray-600 whitespace-nowrap">Apenas estoque baixo</span>
          </label>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
          <p>Nenhum material encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filtrados.length} {filtrados.length === 1 ? 'item encontrado' : 'itens encontrados'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtrados.map(mat => <MaterialCard key={mat.id} material={mat} />)}
          </div>
        </>
      )}
    </div>
  )
}
