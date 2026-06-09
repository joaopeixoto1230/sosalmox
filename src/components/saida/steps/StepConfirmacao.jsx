import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  runTransaction,
  doc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { formatarNumeroOrdem } from '../../../utils/formatters'

export default function StepConfirmacao({ gerador, itens, observacoes, onNovaSaida }) {
  const { uid, nome } = useAuth()
  const [status, setStatus] = useState('idle')
  const [numeroOrdem, setNumeroOrdem] = useState(null)
  const [erro, setErro] = useState('')

  async function confirmarSaida() {
    setStatus('carregando')
    setErro('')
    try {
      const contadorRef = doc(db, 'contadores', 'ordens_saida')
      const ordensRef = collection(db, 'ordens_saida')
      let novoNumero

      await runTransaction(db, async (tx) => {
        const contSnap = await tx.get(contadorRef)
        const atual = contSnap.exists() ? contSnap.data().ultimo : 0
        novoNumero = atual + 1

        for (const item of itens) {
          const matRef = doc(db, 'materiais', item.id)
          const matSnap = await tx.get(matRef)
          if (!matSnap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
          const matData = matSnap.data()
          if (matData.status !== 'disponivel' || matData.estoqueAtual <= 0) {
            throw new Error(`${item.nome} não está mais disponível.`)
          }
        }

        const ordemRef = doc(ordensRef)
        tx.set(ordemRef, {
          numero: novoNumero,
          numeroFormatado: formatarNumeroOrdem(novoNumero),
          eventoId: null,
          eventoNome: null,
          geradorId: gerador?.id || null,
          geradorCodigo: gerador?.codigo || null,
          itens: itens.map(i => ({
            id: i.id,
            nome: i.nome,
            codigo: i.codigo,
            categoria: i.categoria,
          })),
          observacoes,
          operadorUid: uid,
          operadorNome: nome,
          status: 'ativo',
          criadoEm: serverTimestamp(),
        })

        tx.set(contadorRef, { ultimo: novoNumero }, { merge: true })

        for (const item of itens) {
          const matRef = doc(db, 'materiais', item.id)
          tx.update(matRef, {
            status: 'em_evento',
            eventoAtual: null,
            estoqueAtual: 0,
          })
        }

        if (gerador) {
          const ggRef = doc(db, 'geradores', gerador.id)
          tx.update(ggRef, {
            status: 'em_evento',
            eventoAtual: null,
          })
        }
      })

      setNumeroOrdem(formatarNumeroOrdem(novoNumero))
      setStatus('sucesso')
    } catch (err) {
      console.error(err)
      setErro(err.message || 'Erro ao confirmar saída.')
      setStatus('erro')
    }
  }

  if (status === 'idle' || status === 'carregando') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-brand-black">Confirmar Saída</h2>
          <p className="text-sm text-gray-500">Ao confirmar, a Ordem de Material será gerada.</p>
        </div>

        <div className="card bg-amber-50 border-amber-200">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Atenção</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Você está saindo com <strong>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</strong>{gerador ? ` vinculados ao gerador ${gerador.codigo}` : ''}.
                Esta ação atualizará o estoque em tempo real.
              </p>
            </div>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <button
          onClick={confirmarSaida}
          disabled={status === 'carregando'}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {status === 'carregando' ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processando...
            </>
          ) : 'Confirmar Saída'}
        </button>
      </div>
    )
  }

  if (status === 'sucesso') {
    return (
      <div className="text-center py-8 space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-brand-black">Saída Confirmada!</h2>
          <p className="text-gray-500 text-sm mt-1">Ordem de Material gerada com sucesso.</p>
          <div className="inline-block bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-lg px-6 py-2 rounded-xl mt-3">
            {numeroOrdem}
          </div>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={onNovaSaida} className="btn-primary">
            Nova Saída
          </button>
          <Link to="/estoque" className="btn-secondary">
            Ver Estoque
          </Link>
        </div>
      </div>
    )
  }

  return null
}
