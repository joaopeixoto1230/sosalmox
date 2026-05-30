import { useState, useMemo } from 'react'
import { doc, updateDoc, serverTimestamp, runTransaction, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData } from '../../utils/formatters'

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
const PROXIMOS = {
  pendente: { label: 'Em Cotação', value: 'em_cotacao' },
  em_cotacao: { label: 'Marcar Comprado', value: 'comprado' },
  comprado: { label: 'Confirmar Entrega', value: 'entregue' },
}

export default function FilaSolicitacoes() {
  const { uid, nome } = useAuth()
  const { dados: solicitacoes, carregando } = useCollection('solicitacoes_compra')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState(null)
  const [modalEntrega, setModalEntrega] = useState(null)

  const filtradas = useMemo(() => {
    const statusMap = { 'Pendente': 'pendente', 'Em Cotação': 'em_cotacao', 'Comprado': 'comprado', 'Entregue': 'entregue' }
    return solicitacoes
      .filter(s => statusFiltro === 'Todos' || s.status === statusMap[statusFiltro])
      .filter(s => {
        if (!busca) return true
        const q = busca.toLowerCase()
        return s.itemNome?.toLowerCase().includes(q) || s.referencia?.toLowerCase().includes(q) || s.potenciaGG?.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const ordemStatus = { pendente: 0, em_cotacao: 1, comprado: 2, entregue: 3 }
        if (ordemStatus[a.status] !== ordemStatus[b.status]) return ordemStatus[a.status] - ordemStatus[b.status]
        const da = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0)
        const db2 = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0)
        return db2 - da
      })
  }, [solicitacoes, statusFiltro, busca])

  const contadores = useMemo(() => ({
    pendente: solicitacoes.filter(s => s.status === 'pendente').length,
    em_cotacao: solicitacoes.filter(s => s.status === 'em_cotacao').length,
    comprado: solicitacoes.filter(s => s.status === 'comprado').length,
    entregue: solicitacoes.filter(s => s.status === 'entregue').length,
  }), [solicitacoes])

  async function avancarStatus(sol) {
    const proximo = PROXIMOS[sol.status]
    if (!proximo) return
    if (proximo.value === 'entregue') { setModalEntrega(sol); return }
    setAtualizando(sol.id)
    try {
      await updateDoc(doc(db, 'solicitacoes_compra', sol.id), {
        status: proximo.value,
        atualizadoEm: serverTimestamp(),
      })
    } finally {
      setAtualizando(null)
    }
  }

  async function confirmarEntrega(sol, qtdEntregue, preco) {
    setAtualizando(sol.id)
    try {
      await runTransaction(db, async (tx) => {
        tx.update(doc(db, 'solicitacoes_compra', sol.id), {
          status: 'entregue',
          quantidadeEntregue: qtdEntregue,
          precoUnitario: preco || 0,
          total: (preco || 0) * qtdEntregue,
          entregueEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
        if (sol.itemId && sol.tipo === 'filtro') {
          const filtroRef = doc(db, 'filtros', sol.itemId)
          const snap = await tx.get(filtroRef)
          if (snap.exists()) {
            const atual = snap.data().quantidadeAtual || 0
            const entradaRef = doc(collection(db, 'entradas_filtro'))
            tx.set(entradaRef, {
              filtroId: sol.itemId,
              filtroNome: sol.itemNome,
              quantidade: qtdEntregue,
              fornecedor: sol.fornecedor || '',
              dataEntrada: serverTimestamp(),
              operadorUid: uid,
              operadorNome: nome,
              criadoEm: serverTimestamp(),
            })
            tx.update(filtroRef, { quantidadeAtual: atual + qtdEntregue })
          }
        }
      })
      setModalEntrega(null)
    } finally {
      setAtualizando(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Fila de Solicitações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie as solicitações de compra do almoxarifado.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[['pendente', 'Pendentes', 'bg-yellow-50 border-yellow-200'], ['em_cotacao', 'Em Cotação', 'bg-blue-50 border-blue-200'], ['comprado', 'Comprado', 'bg-purple-50 border-purple-200'], ['entregue', 'Entregue', 'bg-green-50 border-green-200']].map(([status, label, cls]) => (
          <div key={status} className={`card border ${cls} text-center py-3`}>
            <p className="text-xl font-bold text-brand-black">{contadores[status]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="input flex-1 min-w-40"
          placeholder="Buscar item, referência, potência..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['Todos', 'Pendente', 'Em Cotação', 'Comprado', 'Entregue'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${statusFiltro === s ? 'bg-white shadow-sm text-brand-black' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Nenhuma solicitação{statusFiltro !== 'Todos' ? ` ${statusFiltro.toLowerCase()}` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(s => (
            <div key={s.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-brand-black text-sm">{s.itemNome}</p>
                  {s.potenciaGG && <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{s.potenciaGG}</span>}
                  <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                  {s.referencia && <p className="text-xs text-gray-400">Ref: {s.referencia}</p>}
                  <p className="text-xs text-gray-400">
                    Estoque: <span className={s.quantidadeAtual <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{s.quantidadeAtual}</span>
                    {' / min '}{s.estoqueMin}
                  </p>
                  <p className="text-xs text-gray-400">Sugerido: <strong className="text-gray-600">{s.quantidadeSugerida}</strong></p>
                  {s.fornecedor && <p className="text-xs text-gray-400">Fornecedor: {s.fornecedor}</p>}
                  <p className="text-xs text-gray-300">{formatarData(s.criadoEm)}</p>
                </div>
              </div>
              {PROXIMOS[s.status] && (
                <button
                  onClick={() => avancarStatus(s)}
                  disabled={atualizando === s.id}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  {atualizando === s.id ? '...' : PROXIMOS[s.status].label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modalEntrega && (
        <ModalConfirmarEntrega
          solicitacao={modalEntrega}
          onConfirmar={(qtd, preco) => confirmarEntrega(modalEntrega, qtd, preco)}
          onFechar={() => setModalEntrega(null)}
          salvando={atualizando === modalEntrega.id}
        />
      )}
    </div>
  )
}

function ModalConfirmarEntrega({ solicitacao, onConfirmar, onFechar, salvando }) {
  const [qtd, setQtd] = useState(String(solicitacao.quantidadeSugerida || 1))
  const [preco, setPreco] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Confirmar entrega</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{solicitacao.itemNome}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade recebida *</label>
            <input type="number" min="1" className="input w-full" value={qtd} onChange={e => setQtd(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço unitário (R$)</label>
            <input type="number" min="0" step="0.01" className="input w-full" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" />
          </div>
          {solicitacao.tipo === 'filtro' && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              ✅ O estoque de filtros será atualizado automaticamente.
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={() => onConfirmar(parseInt(qtd) || 1, parseFloat(preco) || 0)}
              disabled={salvando}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
