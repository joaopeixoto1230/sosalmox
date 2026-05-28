import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  onSnapshot,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useCollection(colecao, restricoes = [], queryKey = '') {
  const [dados, setDados] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const restricoesRef = useRef(restricoes)
  restricoesRef.current = restricoes

  useEffect(() => {
    setCarregando(true)
    const ref = collection(db, colecao)
    const q = restricoesRef.current.length ? query(ref, ...restricoesRef.current) : query(ref)

    const unsub = onSnapshot(
      q,
      (snap) => {
        setDados(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setCarregando(false)
      },
      (err) => {
        console.error('useCollection error:', err)
        setErro(err.message)
        setCarregando(false)
      }
    )
    return unsub
  }, [colecao, queryKey])

  return { dados, carregando, erro }
}

export function useDocument(colecao, docId) {
  const [dado, setDado] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!docId) {
      setDado(null)
      setCarregando(false)
      return
    }
    const ref = doc(db, colecao, docId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setDado(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setCarregando(false)
      },
      (err) => {
        setErro(err.message)
        setCarregando(false)
      }
    )
    return unsub
  }, [colecao, docId])

  return { dado, carregando, erro }
}
