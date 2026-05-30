import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const DOMAIN = '@sosenergia.com'
const STORAGE_KEY = 'sos_lembrar_usuario'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrar, setLembrar] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) {
      setUsuario(salvo)
      setLembrar(true)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence)
      const email = usuario.trim().toLowerCase() + DOMAIN
      await login(email, senha)
      if (lembrar) {
        localStorage.setItem(STORAGE_KEY, usuario.trim().toLowerCase())
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      navigate('/dashboard')
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Usuário ou senha inválidos.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      }
      setErro(msgs[err.code] || err.message || 'Erro ao entrar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo-sos.png"
            alt="SOS Energia"
            className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-lg"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight">SOS Energia</h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de Almoxarifado</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="input"
                placeholder="Ex: joao.silva"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {mostrarSenha ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={e => setLembrar(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-red accent-brand-red"
              />
              <span className="text-sm text-gray-600">Lembrar meu acesso</span>
            </label>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {carregando ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          SOS Energia © {new Date().getFullYear()} — Versão 2.0
        </p>
      </div>
    </div>
  )
}
