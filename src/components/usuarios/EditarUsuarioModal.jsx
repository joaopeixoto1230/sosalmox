import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PERFIS, PERFIL_LABELS } from '../../utils/permissions'

export default function EditarUsuarioModal({ usuario, isSelf, onFechar }) {
  const [form, setForm] = useState({
    nome: usuario.nome || '',
    perfil: usuario.perfil || PERFIS.ALMOXARIFE,
    ativo: usuario.ativo !== false,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return setErro('Informe o nome.')

    setSalvando(true)
    setErro('')
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        nome: form.nome.trim(),
        perfil: form.perfil,
        ativo: form.ativo,
      })
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
          <div>
            <h2 className="font-bold text-brand-black text-lg">Editar usuário</h2>
            <p className="text-xs text-gray-400 mt-0.5">{usuario.email}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={salvar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              className="input w-full"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              autoFocus
            />
          </div>

          {!isSelf && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de acesso</label>
              <select
                className="input w-full"
                value={form.perfil}
                onChange={e => set('perfil', e.target.value)}
              >
                {Object.values(PERFIS).map(p => (
                  <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
                ))}
              </select>
            </div>
          )}

          {!isSelf && (
            <>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-brand-black">Acesso ativo</p>
                  <p className="text-xs text-gray-500">Usuário desativado não consegue entrar</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('ativo', !form.ativo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.ativo ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {!form.ativo && (
                <p className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                  Este usuário não conseguirá acessar o sistema enquanto estiver desativado.
                </p>
              )}
            </>
          )}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
