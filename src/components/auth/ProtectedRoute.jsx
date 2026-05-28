import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, getMenuItems } from '../../utils/permissions'

export default function ProtectedRoute({ children, modulo }) {
  const { usuario, perfil, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  if (modulo && !temPermissao(perfil?.perfil, modulo)) {
    const primeiroItem = getMenuItems(perfil?.perfil)[0]
    const destino = primeiroItem?.path || '/login'
    return <Navigate to={destino} replace />
  }

  return children
}
