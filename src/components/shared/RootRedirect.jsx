import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getMenuItems } from '../../utils/permissions'

export default function RootRedirect() {
  const { tipoPerfil, carregando } = useAuth()

  if (carregando) return null

  const primeiroItem = getMenuItems(tipoPerfil)[0]
  return <Navigate to={primeiroItem?.path || '/login'} replace />
}
