import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection } from '../../hooks/useFirestore'
import { statusOsLabel, statusOsCor } from '../../utils/formatters'
import OSCard from './OSCard'

const STATUS_OPCOES = ['Todos', 'Pendente', 'Em Andamento', 'Concluída']
const STATUS_MAP = { 'Pendente': 'pendente', 'Em Andamento': 'em_andamento', 'Concluída': 'concluida' }

export default function Manutencao() {
  const navigate = useNavigate()
  const { dados: ordens, carregando } = useCollection('ordens_servico')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    return ordens
      .filter(o => {
        if (statusFiltro !== 'Todos' && o.status !== STATUS_MAP[statusFiltro]) return false
        if (tipoFiltro !== 'Todos' && o.tipo !== tipoFiltro.toLowerCase()) return false
        if (busca) {
          const q = busca.toLowerCase()
          return o.equipamentoLabel?.toLowerCase().includes(q) || o.numero?.toLowerCase().includes(q) || o.descricao?.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => {
        if (a.prioridade === 'maxima' && b.prioridade !== 'maxima') return -1
        if (b.prioridade === 'maxima' && a.prioridade !== 'maxima') return 1
        const ta = a.dataAbertura?.toDate ? a.dataAbertura.toDate() : new Date(a.dataAbertura || 0)
        const tb = b.dataAbertura?.toDate ? b.dataAbertura.toDate() : new Date(b.dataAbertura || 0)
        return tb - ta
      })
  }, [ordens, statusFiltro, tipoFiltro, busca])

  const stats = useMemo(() => {
    const agora = new Date()
    const limiteAtrasada = 2 * 24 * 60 * 60 * 1000
    const atrasadas = ordens.filter(o => {
      if (o.status === 'concluida') return false
      const d = o.dataAbertura?.toDate ? o.dataAbertura.toDate() : new Date(o.dataAbertura || 0)
      return (agora - d) >= limiteAtrasada
    })
    return {
      abertas: ordens.filter(o => o.status === 'pendente' || o.status === 'em_andamento').length,
      urgentes: ordens.filter(o => o.prioridade === 'maxima' && o.status !== 'concluida').length,
      concluidas: ordens.filter(o => o.status === 'concluida').length,
      atrasadas,
    }
  }, [ordens])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Manutenção</h1>
          <p className="text-gray-500 text-sm mt-1">Ordens de serviço de geradores, caminhões e empilhadeiras.</p>
        </div>
        <button onClick={() => navigate('/manutencao/nova')} className="btn-primary flex-shrink-0">
          + Nova OS
        </button>
      </div>

      {stats.atrasadas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-red">
              {stats.atrasadas.length} {stats.atrasadas.length === 1 ? 'OS sem conclusão' : 'OS sem conclusão'} há mais de 2 dias
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {stats.atrasadas.map(o => o.numero).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'OS Abertas', valor: stats.abertas, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Urgentes', valor: stats.urgentes, cor: stats.urgentes > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
          { label: 'Concluídas', valor: stats.concluidas, cor: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input type="search" placeholder="Buscar por equipamento, OS ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPCOES.map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${statusFiltro === s ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {s}
            </button>
          ))}
          <div className="h-6 w-px bg-gray-200 self-center" />
          {['Todos', 'Preventiva', 'Corretiva'].map(t => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${tipoFiltro === t ? 'bg-brand-black text-white border-brand-black' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔧</p>
          <p>Nenhuma OS encontrada.</p>
          <button onClick={() => navigate('/manutencao/nova')} className="btn-primary mt-4 mx-auto">Abrir primeira OS</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filtradas.length} {filtradas.length === 1 ? 'ordem encontrada' : 'ordens encontradas'}</p>
          <div className="space-y-3">
            {filtradas.map(os => <OSCard key={os.id} os={os} />)}
          </div>
        </>
      )}
    </div>
  )
}
