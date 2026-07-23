import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, MODULOS } from '../../utils/permissions'
import { statusGeradorLabel, statusGeradorCor } from '../../utils/formatters'
import GGCard from './GGCard'
import NovoGeradorModal from './NovoGeradorModal'

const STATUS_OPCOES = ['Todos', 'Disponível', 'Em Evento', 'Em Locação', 'Manutenção', 'Defeito']
const STATUS_MAP = { 'Disponível': 'disponivel', 'Em Evento': 'em_evento', 'Em Locação': 'locacao', 'Manutenção': 'manutencao', 'Defeito': 'defeito' }

export default function Patrimonio() {
  const navigate = useNavigate()
  const { tipoPerfil } = useAuth()
  const { dados: geradores, carregando } = useCollection('geradores')
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [vista, setVista] = useState('grid')
  const [modalNovo, setModalNovo] = useState(false)

  const podeAdministrar = temPermissao(tipoPerfil, MODULOS.GERADORES) && tipoPerfil !== 'franca'

  const ativos = useMemo(() => geradores.filter(g => g.ativo !== false && g.status !== 'inativo'), [geradores])

  const filtrados = useMemo(() => {
    return ativos.filter(g => {
      if (statusFiltro !== 'Todos' && g.status !== STATUS_MAP[statusFiltro]) return false
      if (busca) {
        const q = busca.toLowerCase()
        return g.codigo?.toLowerCase().includes(q) || g.potencia?.toLowerCase().includes(q) || g.marca?.toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => {
      const na = parseInt(a.codigo?.replace(/\D/g, '') || '0')
      const nb = parseInt(b.codigo?.replace(/\D/g, '') || '0')
      return na - nb
    })
  }, [ativos, busca, statusFiltro])

  const stats = useMemo(() => ({
    total: ativos.length,
    disponiveis: ativos.filter(g => g.status === 'disponivel').length,
    emEvento: ativos.filter(g => g.status === 'em_evento').length,
    comDefeito: ativos.filter(g => g.temDefeito).length,
  }), [ativos])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Patrimônio de Geradores</h1>
          <p className="text-gray-500 text-sm mt-1">Frota completa — {stats.total} geradores ativos.</p>
        </div>
        {podeAdministrar && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate('/manutencao/nova')} className="btn-secondary text-sm">
              + Nova OS
            </button>
            <button onClick={() => setModalNovo(true)} className="btn-primary text-sm">
              + Novo gerador
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total ativo', valor: stats.total, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Disponíveis', valor: stats.disponiveis, cor: 'bg-green-50 text-green-700' },
          { label: 'Em evento', valor: stats.emEvento, cor: 'bg-yellow-50 text-yellow-700' },
          { label: 'Com defeito', valor: stats.comDefeito, cor: stats.comDefeito > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input type="search" placeholder="Buscar por código, potência ou marca..." value={busca} onChange={e => setBusca(e.target.value)} className="input flex-1" />
          <button onClick={() => setVista(v => v === 'grid' ? 'lista' : 'grid')} className="btn-secondary px-3" title="Alternar vista">
            {vista === 'grid' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            )}
          </button>
        </div>
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
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">⚡</p>
          <p>Nenhum gerador encontrado.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filtrados.length} {filtrados.length === 1 ? 'gerador' : 'geradores'}</p>
          {vista === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtrados.map(g => <GGCard key={g.id} gg={g} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(g => (
                <button key={g.id} onClick={() => navigate(`/geradores/${g.id}`)}
                  className="w-full text-left card hover:shadow-md transition-all flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-brand-black">{g.codigo}</p>
                      <span className={`badge ${statusGeradorCor(g.status)}`}>{statusGeradorLabel(g.status)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{g.potencia} • {g.marca} {g.modelo}</p>
                    <p className="text-xs text-gray-400">{g.localizacao || 'Pátio SOS'}</p>
                  </div>
                  {g.horimetroAtual > 0 && <p className="text-sm text-gray-400 flex-shrink-0">{g.horimetroAtual?.toLocaleString('pt-BR')}h</p>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {modalNovo && (
        <NovoGeradorModal
          geradores={geradores}
          onFechar={() => setModalNovo(false)}
          onSalvo={() => setModalNovo(false)}
        />
      )}
    </div>
  )
}
