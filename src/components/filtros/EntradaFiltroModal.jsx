import { useState } from 'react'
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import DatePicker from '../ui/DatePicker'

export default function EntradaFiltroModal({ filtro, onFechar }) {
  const { uid, nome } = useAuth()
  const [form, setForm] = useState({ quantidade: '', nf: '', fornecedor: filtro.fornecedor || '', validade: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function confirmar() {
    const qtd = parseInt(form.quantidade)
    if (!qtd || qtd <= 0) { setErro('Informe uma quantidade válida.'); return }
    setSalvando(true); setErro('')
    try {
      await runTransaction(db, async (tx) => {
        const filtroRef = doc(db, 'filtros', filtro.id)
        const snap = await tx.get(filtroRef)
        const atual = snap.data()?.quantidadeAtual || 0
        tx.update(filtroRef, { quantidadeAtual: atual + qtd })
        const entradaRef = doc(collection(db, 'entradas_filtro'))
        tx.set(entradaRef, {
          filtroId: filtro.id,
          filtroNome: filtro.nome,
          quantidade: qtd,
          nf: form.nf,
          fornecedor: form.fornecedor,
          dataEntrada: serverTimestamp(),
          validade: form.validade ? new Date(form.validade) : null,
          operadorUid: uid,
          operadorNome: nome,
          criadoEm: serverTimestamp(),
        })
      })
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao registrar entrada.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-brand-black">Registrar Entrada</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{filtro.nome}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade *</label>
            <input type="number" min="1" value={form.quantidade} onChange={e => set('quantidade', e.target.value)} className="input" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nota Fiscal</label>
            <input value={form.nf} onChange={e => set('nf', e.target.value)} className="input" placeholder="NF-000000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fornecedor</label>
            <input value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} className="input" placeholder="Nome do fornecedor" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Validade do lote</label>
            <DatePicker value={form.validade} onChange={v => set('validade', v)} />
          </div>
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button onClick={confirmar} disabled={salvando} className="btn-primary flex-1 justify-center">
            {salvando ? 'Salvando...' : 'Confirmar Entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}
