import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { PERFIL_LABELS, PERFIL_CORES } from '../../utils/permissions'

function useNotificacoes(uid) {
  const [notificacoes, setNotificacoes] = useState([])
  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'notificacoes'), where('lida', '==', false))
    const unsub = onSnapshot(q, snap => {
      const todas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => n.uid === uid || n.uid === 'all')
        .sort((a, b) => (b.criadoEm?.toDate?.()?.getTime() || 0) - (a.criadoEm?.toDate?.()?.getTime() || 0))
      setNotificacoes(todas)
    }, () => {})
    return unsub
  }, [uid])
  return notificacoes
}

const TIPO_COR = {
  aviso: 'bg-yellow-100 text-yellow-700',
  urgente: 'bg-red-100 text-brand-red',
  info: 'bg-blue-100 text-blue-700',
  sucesso: 'bg-green-100 text-green-700',
}

export default function Header({ onAbrirMenu }) {
  const { uid, nome, tipoPerfil, logout } = useAuth()
  const navigate = useNavigate()
  const notificacoes = useNotificacoes(uid)
  const [aberto, setAberto] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    function fechar(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setAberto(false)
    }
    if (aberto) document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  async function marcarTodasLidas() {
    if (!notificacoes.length) return
    const batch = writeBatch(db)
    notificacoes.forEach(n => batch.update(doc(db, 'notificacoes', n.id), { lida: true }))
    await batch.commit()
  }

  async function clicarNotificacao(n) {
    await updateDoc(doc(db, 'notificacoes', n.id), { lida: true })
    setAberto(false)
    if (n.link) navigate(n.link)
  }

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

        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setAberto(v => !v)}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            title="Notificações"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notificacoes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {notificacoes.length > 9 ? '9+' : notificacoes.length}
              </span>
            )}
          </button>

          {aberto && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-sm text-brand-black">Notificações</p>
                {notificacoes.length > 0 && (
                  <button onClick={marcarTodasLidas} className="text-xs text-brand-red hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificacoes.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Nenhuma notificação nova.</p>
                ) : (
                  notificacoes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => clicarNotificacao(n)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`badge text-xs mt-0.5 flex-shrink-0 ${TIPO_COR[n.tipo] || TIPO_COR.info}`}>
                          {n.tipo === 'urgente' ? '!' : n.tipo === 'aviso' ? '⚠' : 'i'}
                        </span>
                        <p className="text-sm text-gray-700 leading-snug">{n.mensagem}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
