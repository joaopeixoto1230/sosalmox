import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { PERFIL_LABELS, PERFIL_CORES, PERFIS } from '../../utils/permissions'
import NovoUsuarioModal from './NovoUsuarioModal'
import EditarUsuarioModal from './EditarUsuarioModal'

export default function Usuarios() {
  const { uid } = useAuth()
  const { dados: usuarios, carregando } = useCollection('usuarios')
  const [novoAberto, setNovoAberto] = useState(false)
  const [editando, setEditando] = useState(null)

  const ordenados = [...usuarios].sort((a, b) => {
    const ordem = ['admin', 'gerente', 'almoxarife', 'franca', 'compras']
    return ordem.indexOf(a.perfil) - ordem.indexOf(b.perfil)
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os acessos ao sistema.</p>
        </div>
        <button onClick={() => setNovoAberto(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo usuário
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(PERFIS).map(([, valor]) => {
          const total = usuarios.filter(u => u.perfil === valor).length
          return (
            <div key={valor} className="card border-0 bg-gray-50">
              <p className="text-xl font-bold text-brand-black">{total}</p>
              <p className="text-xs text-gray-500">{PERFIL_LABELS[valor]}</p>
            </div>
          )
        })}
      </div>

      {carregando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {ordenados.map(u => (
            <div key={u.id} className={`card flex items-center gap-4 ${!u.ativo ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-600">
                  {(u.nome || u.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-brand-black text-sm">{u.nome}</p>
                  {u.id === uid && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">você</span>
                  )}
                  {!u.ativo && (
                    <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">inativo</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.username || u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`badge ${PERFIL_CORES[u.perfil] || 'bg-gray-200 text-gray-600'}`}>
                  {PERFIL_LABELS[u.perfil] || u.perfil}
                </span>
                {u.id !== uid && (
                  <button
                    onClick={() => setEditando(u)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {novoAberto && <NovoUsuarioModal onFechar={() => setNovoAberto(false)} />}
      {editando && <EditarUsuarioModal usuario={editando} onFechar={() => setEditando(null)} />}
    </div>
  )
}
