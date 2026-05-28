import { useAuth } from '../../contexts/AuthContext'
import { PERFIL_LABELS, PERFIL_CORES } from '../../utils/permissions'

export default function Header({ onAbrirMenu }) {
  const { nome, tipoPerfil, logout } = useAuth()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-10">
      <button
        onClick={onAbrirMenu}
        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {tipoPerfil && (
          <span className={`badge ${PERFIL_CORES[tipoPerfil]} hidden sm:inline-flex`}>
            {PERFIL_LABELS[tipoPerfil]}
          </span>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-red rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {nome?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {nome?.split(' ')[0]}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-brand-red transition-colors text-gray-400"
          title="Sair"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  )
}
