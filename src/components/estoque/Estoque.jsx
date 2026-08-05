import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import MaterialCard from './MaterialCard'
import NovoMaterialModal from './NovoMaterialModal'
import { GRUPOS, grupoDoMaterial, categoriasDoGrupo } from './categorias'

const STATUS_OPCOES = [
  { label: 'Todos', value: null, ativo: 'bg-brand-black text-white', inativo: 'bg-white border-gray-200 text-gray-600' },
  { label: 'Disponível', value: 'disponivel', ativo: 'bg-green-500 text-white border-green-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600' },
  { label: 'Em Evento', value: 'em_evento', ativo: 'bg-yellow-500 text-white border-yellow-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-yellow-400 hover:text-yellow-600' },
  { label: 'Manutenção', value: 'manutencao', ativo: 'bg-blue-500 text-white border-blue-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600' },
  { label: 'Emprestado', value: 'emprestado', ativo: 'bg-indigo-500 text-white border-indigo-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600' },
  { label: 'Perdido', value: 'perdido', ativo: 'bg-red-500 text-white border-red-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600' },
  { label: 'Consumido', value: 'consumido', ativo: 'bg-gray-500 text-white border-gray-500', inativo: 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-700' },
]

export default function Estoque() {
  const { dados: materiais, carregando } = useCollection('materiais')
  const { dados: eventos } = useCollection('eventos')
  const eventosMap = useMemo(() => new Map(eventos.map(e => [e.id, e])), [eventos])
  const [grupo, setGrupo] = useState('eventos')
  const [categoria, setCategoria] = useState('Todos')
  const [statusFiltro, setStatusFiltro] = useState(null)
  const [busca, setBusca] = useState('')
  const [apenasEstoqueBaixo, setApenasEstoqueBaixo] = useState(false)
  const [novoMaterialAberto, setNovoMaterialAberto] = useState(false)

  // Materiais do grupo selecionado (doc sem `grupo` = eventos).
  const materiaisDoGrupo = useMemo(
    () => materiais.filter(m => grupoDoMaterial(m) === grupo),
    [materiais, grupo]
  )

  function trocarGrupo(g) {
    if (g === grupo) return
    setGrupo(g)
    setCategoria('Todos')
    setStatusFiltro(null)
    setApenasEstoqueBaixo(false)
  }

  // Abas de categoria: padroes do grupo + categorias extras criadas pelo usuario
  // (derivadas dos materiais ja cadastrados nesse grupo).
  const categoriasTabs = useMemo(
    () => ['Todos', ...categoriasDoGrupo(grupo, materiais)],
    [grupo, materiais]
  )

  const filtrados = useMemo(() => {
    return materiaisDoGrupo.filter(m => {
      if (categoria !== 'Todos' && m.categoria !== categoria) return false
      if (statusFiltro && m.status !== statusFiltro) return false
      if (apenasEstoqueBaixo && !(m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0)) return false
      if (busca) {
        const q = busca.toLowerCase()
        return m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q)
      }
      return true
    })
  }, [materiaisDoGrupo, categoria, statusFiltro, busca, apenasEstoqueBaixo])

  const stats = useMemo(() => ({
    total: materiaisDoGrupo.length,
    disponiveis: materiaisDoGrupo.filter(m => m.status === 'disponivel').length,
    emCampo: materiaisDoGrupo.filter(m => m.status === 'em_evento').length,
    manutencao: materiaisDoGrupo.filter(m => m.status === 'manutencao').length,
    perdido: materiaisDoGrupo.filter(m => m.status === 'perdido').length,
    emprestado: materiaisDoGrupo.filter(m => m.status === 'emprestado').length,
    consumido: materiaisDoGrupo.filter(m => m.status === 'consumido').length,
    estoqueBaixo: materiaisDoGrupo.filter(m => m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0).length,
  }), [materiaisDoGrupo])

  const contagemPorStatus = {
    null: stats.total,
    disponivel: stats.disponiveis,
    em_evento: stats.emCampo,
    manutencao: stats.manutencao,
    perdido: stats.perdido,
    emprestado: stats.emprestado,
    consumido: stats.consumido,
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

      <div className="grid grid-cols-2 gap-1.5 bg-gray-100 rounded-2xl p-1.5">
        {GRUPOS.map(g => (
          <button
            key={g.value}
            onClick={() => trocarGrupo(g.value)}
            className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors
              ${grupo === g.value ? 'bg-brand-red text-white shadow-sm' : 'text-gray-600 hover:text-brand-red'}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total de Itens', valor: stats.total, cor: 'bg-blue-50 text-blue-700',
            ativo: false,
            onClick: () => { setStatusFiltro(null); setApenasEstoqueBaixo(false) },
          },
          {
            label: 'Disponíveis', valor: stats.disponiveis, cor: 'bg-green-50 text-green-700',
            ativo: statusFiltro === 'disponivel',
            onClick: () => { setStatusFiltro('disponivel'); setApenasEstoqueBaixo(false) },
          },
          grupo === 'uso_interno'
            ? {
                label: 'Emprestados', valor: stats.emprestado, cor: 'bg-indigo-50 text-indigo-700',
                ativo: statusFiltro === 'emprestado',
                onClick: () => { setStatusFiltro('emprestado'); setApenasEstoqueBaixo(false) },
              }
            : {
                label: 'Em Campo', valor: stats.emCampo, cor: 'bg-yellow-50 text-yellow-700',
                ativo: statusFiltro === 'em_evento',
                onClick: () => { setStatusFiltro('em_evento'); setApenasEstoqueBaixo(false) },
              },
          {
            label: 'Estoque Baixo', valor: stats.estoqueBaixo, cor: stats.estoqueBaixo > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700',
            ativo: apenasEstoqueBaixo,
            onClick: () => { setApenasEstoqueBaixo(v => !v); setStatusFiltro(null) },
          },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`card ${s.cor} border-0 text-left transition-all cursor-pointer hover:opacity-90
              ${s.ativo ? 'ring-2 ring-current' : ''}`}
          >
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-sm font-medium">{s.label}</p>
          </button>
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
          {categoriasTabs.map(cat => (
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
            {filtrados.map(mat => <MaterialCard key={mat.id} material={mat} evento={eventosMap.get(mat.eventoAtual)} />)}
          </div>
        </>
      )}
    </div>
  )
}
