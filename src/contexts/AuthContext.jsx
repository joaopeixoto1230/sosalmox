import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let active = true
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
        if (!active) return
        const dados = snap.exists() ? snap.data() : {}
        setUsuario(firebaseUser)
        setPerfil(dados)
      } else {
        if (!active) return
        setUsuario(null)
        setPerfil(null)
      }
      setCarregando(false)
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  async function login(email, senha) {
    const cred = await signInWithEmailAndPassword(auth, email, senha)
    const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
    if (!snap.exists()) throw new Error('Usuário não encontrado no sistema.')
    const dados = snap.data()
    if (dados.ativo === false) throw new Error('Usuário desativado. Contate o administrador.')
    return cred
  }

  async function logout() {
    await signOut(auth)
  }

  const valor = {
    usuario,
    perfil,
    carregando,
    login,
    logout,
    uid: usuario?.uid,
    nome: perfil?.nome || usuario?.email,
    tipoPerfil: perfil?.perfil,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
