import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, MODULOS } from '../../utils/permissions'
import { statusGeradorLabel, statusGeradorCor, statusEfetivoCaminhao, caminhaoKm, tipoVeiculo } from '../../utils/formatters'
import CaminhaoCard from './CaminhaoCard'
import NovoCaminhaoModal from './NovoCaminhaoModal'
import { FROTA_INICIAL } from './frotaInicial'

const STATUS_OPCOES = ['Todos', 'Disponível', 'Em Evento', 'Em Locação', 'Manutenção', 'Defeito']
const STATUS_MAP = { 'Disponível': 'disponivel', 'Em Evento': 'em_evento', 'Em Locação': 'locacao', 'Manutenção': 'manutencao', 'Defeito': 'defeito' }
const TIPO_OPCOES = [
  { value: 'todos', label: 'Todos' },
  { value: 'caminhao', label: 'Caminhões' },
  { value: 'carro', label: 'Carros' },
]

export default function Caminhoes() {
  const navigate = useNavigate()
  const { tipoPerfil } = useAuth()
  const { dados: caminhoes, carregando } = useCollection('caminhoes')
  const { dados: geradores } = useCollection('geradores')
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [vista, setVista] = useState('grid')
  const [importando, setImportando] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)

  const podeAdministrar = temPermissao(tipoPerfil, MODULOS.CAMINHOES) && tipoPerfil !== 'franca'

  // Importacao unica da frota inicial. So aparece para o admin enquanto a
  // colecao estiver vazia; depois de importar, some sozinha.
  const mostrarImportar = tipoPerfil === 'admin' && !carregando && caminhoes.length === 0

  async function importarFrota() {
    if (caminhoes.length > 0) return
    if (!window.confirm(`Importar ${FROTA_INICIAL.length} veículos da Relação de Veículos? Isso só deve ser feito uma vez.`)) return
    setImportando(true)
    try {
      const batch = writeBatch(db)
      for (const c of FROTA_INICIAL) {
        const ref = doc(collection(db, 'caminhoes'))
        batch.set(ref, { ...c, criadoEm: serverTimestamp() })
      }
      await batch.commit()
    } catch (err) {
      alert(err?.message || 'Não foi possível importar a frota. Tente novamente.')
    } finally {
      setImportando(false)
    }
  }

  // Gerador montado em cada caminhao (vinculo opcional). O status exibido segue
  // esse gerador quando ele esta em evento/locacao — ver statusEfetivoCaminhao.
  const gerMap = useMemo(() => new Map(geradores.map(g => [g.id, g])), [geradores])
  const geradorDe = (c) => (c.geradorMontadoId ? gerMap.get(c.geradorMontadoId) : null)
  const statusDe = (c) => statusEfetivoCaminhao(c, geradorDe(c))

  const ativos = useMemo(() => caminhoes.filter(c => c.ativo !== false && c.status !== 'inativo'), [caminhoes])

  // Recorte por tipo (Caminhões / Carros / Todos): vale para os stats e a lista.
  const daFrota = useMemo(
    () => (tipoFiltro === 'todos' ? ativos : ativos.filter(c => tipoVeiculo(c) === tipoFiltro)),
    [ativos, tipoFiltro]
  )

  const filtrados = useMemo(() => {
    return daFrota.filter(c => {
      if (statusFiltro !== 'Todos' && statusDe(c) !== STATUS_MAP[statusFiltro]) return false
      if (busca) {
        const q = busca.toLowerCase()
        return c.placa?.toLowerCase().includes(q) || c.marca?.toLowerCase().includes(q) || c.modelo?.toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => (a.placa || '').localeCompare(b.placa || ''))
  }, [daFrota, busca, statusFiltro, gerMap])

  const stats = useMemo(() => ({
    total: daFrota.length,
    disponiveis: daFrota.filter(c => statusDe(c) === 'disponivel').length,
    emEvento: daFrota.filter(c => statusDe(c) === 'em_evento').length,
    comDefeito: daFrota.filter(c => statusDe(c) === 'defeito').length,
  }), [daFrota, gerMap])

  const totalGeral = ativos.length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Frota de Veículos</h1>
          <p className="text-gray-500 text-sm mt-1">Frota completa — {totalGeral} veículos ativos.</p>
        </div>
        {podeAdministrar && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate('/manutencao/nova')} className="btn-secondary text-sm">
              + Nova OS
            </button>
            <button onClick={() => setModalNovo(true)} className="btn-primary text-sm">
              + Novo veículo
            </button>
          </div>
        )}
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1">
        {TIPO_OPCOES.map(t => (
          <button key={t.value} onClick={() => setTipoFiltro(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoFiltro === t.value ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
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
          <input type="search" placeholder="Buscar por placa, marca ou modelo..." value={busca} onChange={e => setBusca(e.target.value)} className="input flex-1" />
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
          <p className="text-4xl mb-3">🚚</p>
          <p>Nenhum veículo encontrado.</p>
          {mostrarImportar && (
            <button onClick={importarFrota} disabled={importando} className="btn-primary mt-4 disabled:opacity-60">
              {importando ? 'Importando...' : `Importar frota inicial (${FROTA_INICIAL.length} veículos)`}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filtrados.length} {filtrados.length === 1 ? 'veículo' : 'veículos'}</p>
          {vista === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtrados.map(c => <CaminhaoCard key={c.id} caminhao={c} gerador={geradorDe(c)} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(c => (
                <button key={c.id} onClick={() => navigate(`/caminhoes/${c.id}`)}
                  className="w-full text-left card hover:shadow-md transition-all flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-brand-black">{c.placa}</p>
                      <span className={`badge ${statusGeradorCor(statusDe(c))}`}>{statusGeradorLabel(statusDe(c))}</span>
                    </div>
                    <p className="text-xs text-gray-500">{c.marca} {c.modelo}{c.ano ? ` (${c.ano})` : ''}</p>
                    <p className="text-xs text-gray-400">{c.localizacao || 'Pátio SOS'}</p>
                  </div>
                  {caminhaoKm(c) > 0 && <p className="text-sm text-gray-400 flex-shrink-0">{caminhaoKm(c).toLocaleString('pt-BR')} km</p>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {modalNovo && (
        <NovoCaminhaoModal onFechar={() => setModalNovo(false)} onSalvo={() => setModalNovo(false)} />
      )}
    </div>
  )
}
