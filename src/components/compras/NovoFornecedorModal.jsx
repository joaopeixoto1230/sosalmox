import { useState } from 'react'
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function NovoFornecedorModal({ fornecedor, onFechar }) {
  const [form, setForm] = useState({
    nome: fornecedor?.nome || '',
    responsavel: fornecedor?.responsavel || '',
    telefone: fornecedor?.telefone || '',
    email: fornecedor?.email || '',
    produtos: fornecedor?.produtos || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); setErro('') }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return setErro('Informe o nome do fornecedor.')
    setSalvando(true)
    try {
      if (fornecedor?.id) {
        await updateDoc(doc(db, 'fornecedores', fornecedor.id), { ...form, atualizadoEm: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'fornecedores'), { ...form, ativo: true, criadoEm: serverTimestamp() })
      }
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black text-lg">
            {fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
          </h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa *</label>
            <input className="input w-full" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Filtros Brasil Ltda" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <input className="input w-full" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Nome do contato" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
              <input className="input w-full" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(61) 9 0000-0000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input className="input w-full" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@fornecedor.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produtos / especialidade</label>
            <input className="input w-full" value={form.produtos} onChange={e => set('produtos', e.target.value)} placeholder="Ex: Filtros de óleo, combustível e ar" />
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
