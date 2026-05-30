import { useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PERFIS, PERFIL_LABELS } from '../../utils/permissions'

function getSecondaryAuth() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
  const existing = getApps().find(a => a.name === 'secondary')
  const app = existing || initializeApp(config, 'secondary')
  return getAuth(app)
}

export default function NovoUsuarioModal({ onFechar }) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfil: PERFIS.ALMOXARIFE })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return setErro('Informe o nome completo.')
    if (!form.email.trim()) return setErro('Informe o e-mail.')
    if (form.senha.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.')

    setSalvando(true)
    setErro('')
    try {
      const secondaryAuth = getSecondaryAuth()
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.senha)
      await secondaryAuth.signOut()

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nome: form.nome.trim(),
        email: form.email.trim(),
        perfil: form.perfil,
        ativo: true,
        criadoEm: serverTimestamp(),
      })

      onFechar()
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setErro('Este e-mail já está em uso.')
      else if (e.code === 'auth/invalid-email') setErro('E-mail inválido.')
      else setErro('Erro ao criar usuário: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black text-lg">Novo usuário</h2>
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
              placeholder="Ex: João da Silva"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              className="input w-full"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@sosenergia.com.br"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
            <input
              className="input w-full"
              type="password"
              value={form.senha}
              onChange={e => set('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

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

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
