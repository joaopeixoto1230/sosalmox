import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, MODULOS, PERFIS } from '../../utils/permissions'
import FiltroCard from './FiltroCard'
import EntradaFiltroModal from './EntradaFiltroModal'
import BaixaFiltroModal from './BaixaFiltroModal'
import NovoFiltroModal from './NovoFiltroModal'

const STATUS_OPCOES = ['Todos', 'OK', 'Baixo', 'Crítico']

export default function Filtros() {
  const { tipoPerfil } = useAuth()
  const { dados: filtros, carregando } = useCollection('filtros')
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [modalEntrada, setModalEntrada] = useState(null)
  const [modalBaixa, setModalBaixa] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)

  const podeAdministrar = temPermissao(tipoPerfil, MODULOS.ESTOQUE) || tipoPerfil === PERFIS.ADMIN

  const filtrados = useMemo(() => {
    return filtros
      .filter(f => f.ativo !== false)
      .filter(f => {
        if (!busca) return true
        const q = busca.toLowerCase()
        return f.nome?.toLowerCase().includes(q) || f.referencia?.toLowerCase().includes(q) || f.potenciaGG?.toLowerCase().includes(q)
      })
      .filter(f => {
        if (statusFiltro === 'Todos') return true
        const qtd = f.quantidadeAtual || 0
        const min = f.estoqueMin || 0
        if (statusFiltro === 'Crítico') return qtd <= 0
        if (statusFiltro === 'Baixo') return qtd > 0 && qtd <= min
        if (statusFiltro === 'OK') return qtd > min
        return true
      })
  }, [filtros, busca, statusFiltro])

  const agrupados = useMemo(() => {
    const map = new Map()
    filtrados.forEach(f => {
      const key = f.potenciaGG || 'Outros'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(f)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      const numA = parseInt(a) || Infinity
      const numB = parseInt(b) || Infinity
      return numA - numB
    })
  }, [filtrados])

  const stats = useMemo(() => ({
    total: filtros.filter(f => f.ativo !== false).length,
    criticos: filtros.filter(f => (f.quantidadeAtual || 0) <= 0).length,
    baixos: filtros.filter(f => { const q = f.quantidadeAtual || 0; const m = f.estoqueMin || 0; return q > 0 && q <= m }).length,
  }), [filtros])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Filtros</h1>
          <p className="text-gray-500 text-sm mt-1">Estoque de filtros organizado por potência de gerador.</p>
        </div>
        {podeAdministrar && (
          <button onClick={() => setModalNovo(true)} className="btn-primary flex-shrink-0">
            + Novo Filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total de filtros', valor: stats.total, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Estoque baixo', valor: stats.baixos, cor: stats.baixos > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700' },
          { label: 'Crítico / zerado', valor: stats.criticos, cor: stats.criticos > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input type="search" placeholder="Buscar por nome, referência ou potência..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPCOES.map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${statusFiltro === s ? 'bg-brand-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agrupados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔧</p>
          <p>Nenhum filtro encontrado.</p>
          {podeAdministrar && <button onClick={() => setModalNovo(true)} className="btn-primary mt-4 mx-auto">Cadastrar primeiro filtro</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {agrupados.map(([potencia, itens]) => (
            <div key={potencia}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-brand-black bg-brand-red/10 text-brand-red px-3 py-1 rounded-full">{potencia}</span>
                <span className="text-xs text-gray-400">{itens.length} {itens.length === 1 ? 'filtro' : 'filtros'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {itens.map(f => (
                  <FiltroCard key={f.id} filtro={f} onEntrada={setModalEntrada} onBaixa={setModalBaixa} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalEntrada && <EntradaFiltroModal filtro={modalEntrada} onFechar={() => setModalEntrada(null)} />}
      {modalBaixa && <BaixaFiltroModal filtro={modalBaixa} onFechar={() => setModalBaixa(null)} />}
      {modalNovo && <NovoFiltroModal onFechar={() => setModalNovo(false)} />}
    </div>
  )
}
