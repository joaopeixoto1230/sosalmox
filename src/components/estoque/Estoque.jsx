import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import MaterialCard from './MaterialCard'

const CATEGORIAS = ['Todos', 'Cabos 4x', 'Cabos Terra', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']
const STATUS_FILTROS = ['Todos', 'Disponível', 'Em Evento', 'Manutenção', 'Perdido']
const STATUS_MAP = { 'Disponível': 'disponivel', 'Em Evento': 'em_evento', 'Manutenção': 'manutencao', 'Perdido': 'perdido' }

export default function Estoque() {
  const { dados: materiais, carregando } = useCollection('materiais')
  const [categoria, setCategoria] = useState('Todos')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [apenasEstoqueBaixo, setApenasEstoqueBaixo] = useState(false)

  const filtrados = useMemo(() => {
    return materiais.filter(m => {
      if (categoria !== 'Todos' && m.categoria !== categoria) return false
      if (statusFiltro !== 'Todos' && m.status !== STATUS_MAP[statusFiltro]) return false
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
    estoqueBaixo: materiais.filter(m => m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0).length,
  }), [materiais])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Estoque</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral de todos os materiais do almoxarifado.</p>
      </div>

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

        <div className="flex items-center gap-3 flex-wrap">
          {STATUS_FILTROS.map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors
                ${statusFiltro === s ? 'bg-brand-black text-white border-brand-black' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {s}
            </button>
          ))}
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
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
