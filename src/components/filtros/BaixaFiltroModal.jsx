import { useState } from 'react'
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { criarSolicitacaoCompra } from '../../utils/notificacoes'

export default function BaixaFiltroModal({ filtro, onFechar }) {
  const { uid, nome } = useAuth()
  const [form, setForm] = useState({ quantidade: '1', motivo: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function confirmar() {
    const qtd = parseInt(form.quantidade)
    if (!qtd || qtd <= 0) { setErro('Informe uma quantidade válida.'); return }
    setSalvando(true); setErro('')
    try {
      let novaQtd = 0
      await runTransaction(db, async (tx) => {
        const filtroRef = doc(db, 'filtros', filtro.id)
        const snap = await tx.get(filtroRef)
        const atual = snap.data()?.quantidadeAtual || 0
        novaQtd = atual - qtd
        tx.update(filtroRef, { quantidadeAtual: novaQtd })
        const baixaRef = doc(collection(db, 'baixas_filtro'))
        tx.set(baixaRef, {
          filtroId: filtro.id,
          filtroNome: filtro.nome,
          quantidade: qtd,
          motivo: form.motivo || 'Baixa manual',
          operadorUid: uid,
          operadorNome: nome,
          criadoEm: serverTimestamp(),
        })
      })
      if (novaQtd <= (filtro.estoqueMin || 0) && filtro.estoqueMin > 0) {
        await criarSolicitacaoCompra({ ...filtro, quantidadeAtual: novaQtd })
      }
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao registrar baixa.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-brand-black">Dar Baixa</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          {filtro.nome} — estoque atual: <strong>{filtro.quantidadeAtual}</strong>
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade *</label>
            <input type="number" min="1" max={filtro.quantidadeAtual} value={form.quantidade} onChange={e => set('quantidade', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
            <input value={form.motivo} onChange={e => set('motivo', e.target.value)} className="input" placeholder="Ex: troca preventiva, avaria..." />
          </div>
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button onClick={confirmar} disabled={salvando} className="btn-primary flex-1 justify-center">
            {salvando ? 'Salvando...' : 'Confirmar Baixa'}
          </button>
        </div>
      </div>
    </div>
  )
}
