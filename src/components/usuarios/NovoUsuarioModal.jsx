import { useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PERFIS, PERFIL_LABELS } from '../../utils/permissions'

const DOMAIN = '@sosalmox.app'

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
  const [form, setForm] = useState({ nome: '', username: '', senha: '', perfil: PERFIS.ALMOXARIFE })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  function normalizeUsername(v) {
    return v.toLowerCase().replace(/[^a-z0-9._-]/g, '')
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) return setErro('Informe o nome completo.')
    if (!form.username.trim()) return setErro('Informe o nome de usuário.')
    if (form.senha.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.')

    setSalvando(true)
    setErro('')
    try {
      const email = form.username.trim() + DOMAIN
      const secondaryAuth = getSecondaryAuth()
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, form.senha)
      await secondaryAuth.signOut()

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nome: form.nome.trim(),
        username: form.username.trim(),
        email,
        perfil: form.perfil,
        ativo: true,
        criadoEm: serverTimestamp(),
      })

      onFechar()
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setErro('Este nome de usuário já está em uso.')
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário</label>
            <div className="flex items-center gap-0">
              <input
                className="input w-full rounded-r-none"
                value={form.username}
                onChange={e => set('username', normalizeUsername(e.target.value))}
                placeholder="joao.silva"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className="bg-gray-100 border border-l-0 border-gray-300 px-3 h-10 flex items-center text-gray-400 text-sm rounded-r-lg whitespace-nowrap">
                {DOMAIN}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Apenas letras minúsculas, números, ponto e hífen.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
            <input
              className="input w-full"
              type="password"
              value={form.senha}
              onChange={e => set('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
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
