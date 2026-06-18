import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  runTransaction,
  doc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { formatarNumeroOrdem, materialPorQuantidade } from '../../../utils/formatters'
import { comprimirParaDataUrl } from '../../../utils/imagem'

export default function StepConfirmacao({ evento, geradores, itens, observacoes, responsavel, onNovaSaida }) {
  const { uid, nome } = useAuth()
  const [status, setStatus] = useState('idle')
  const [numeroOrdem, setNumeroOrdem] = useState(null)
  const [erro, setErro] = useState('')
  const [fotos, setFotos] = useState([])
  const [progresso, setProgresso] = useState(null) // { atual, total } durante o envio
  const fotoInputRef = useRef(null)

  // libera as URLs de preview da memoria quando o componente desmonta
  useEffect(() => {
    return () => fotos.forEach(f => URL.revokeObjectURL(f.preview))
  }, [fotos])

  function adicionarFotos(e) {
    const arquivos = Array.from(e.target.files || [])
    if (arquivos.length === 0) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  function removerFoto(idx) {
    setFotos(prev => {
      const f = prev[idx]
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const codigosGeradores = geradores?.length > 0
    ? geradores.map(g => g.codigo).join(', ')
    : null

  async function confirmarSaida() {
    setStatus('carregando')
    setErro('')
    try {
      const contadorRef = doc(db, 'contadores', 'ordens_saida')
      const ordemRef = doc(collection(db, 'ordens_saida'))
      let novoNumero

      // Envia as fotos primeiro (uma por documento em fotos_saida, comprimidas
      // para caber no limite de 1 MB do Firestore). Se falhar, a saida nem e
      // gravada — mesmo padrao das fotos da OS de Manutencao.
      if (fotos.length > 0) {
        for (let i = 0; i < fotos.length; i++) {
          setProgresso({ atual: i + 1, total: fotos.length })
          const dataUrl = await comprimirParaDataUrl(fotos[i].file)
          await addDoc(collection(db, 'fotos_saida'), {
            ordemId: ordemRef.id,
            ordem: i,
            dataUrl,
            criadoPor: uid,
            criadoPorNome: nome,
            criadoEm: serverTimestamp(),
          })
        }
        setProgresso(null)
      }

      await runTransaction(db, async (tx) => {
        const contSnap = await tx.get(contadorRef)
        const atual = contSnap.exists() ? contSnap.data().ultimo : 0
        novoNumero = atual + 1

        for (const item of itens) {
          // Materiais por quantidade (protetor de cabo) nao prendem estoque:
          // saem em varias unidades e seguem disponiveis para outros eventos.
          if (materialPorQuantidade(item)) continue
          const matRef = doc(db, 'materiais', item.id)
          const matSnap = await tx.get(matRef)
          if (!matSnap.exists()) throw new Error(`Material ${item.nome} não encontrado.`)
          const matData = matSnap.data()
          if (matData.status !== 'disponivel' || matData.estoqueAtual <= 0) {
            throw new Error(`${item.nome} não está mais disponível.`)
          }
        }

        // Cria o evento agora, dentro da transacao: so passa a existir se a
        // saida for confirmada. Voltar/abandonar o fluxo nao grava nada.
        let eventoIdFinal = evento?.id || null
        if (evento?.novo) {
          const eventoRef = doc(collection(db, 'eventos'))
          eventoIdFinal = eventoRef.id
          tx.set(eventoRef, {
            nome: evento.nome,
            local: evento.local,
            data: evento.data,
            status: evento.status || 'ativo',
            criadoEm: serverTimestamp(),
          })
        }

        tx.set(ordemRef, {
          numero: novoNumero,
          numeroFormatado: formatarNumeroOrdem(novoNumero),
          eventoId: eventoIdFinal,
          eventoNome: evento?.nome || null,
          qtdFotos: fotos.length,
          geradores: (geradores || []).map(g => ({ id: g.id, codigo: g.codigo })),
          geradorCodigo: geradores?.length > 0 ? geradores[0].codigo : null,
          itens: itens.map(i => ({
            id: i.id,
            nome: i.nome,
            codigo: i.codigo,
            categoria: i.categoria,
            ...(materialPorQuantidade(i) ? { quantidade: i.quantidade || 1 } : {}),
          })),
          observacoes,
          responsavelNome: responsavel || null,
          operadorUid: uid,
          operadorNome: nome,
          status: 'ativo',
          criadoEm: serverTimestamp(),
        })

        tx.set(contadorRef, { ultimo: novoNumero }, { merge: true })

        for (const item of itens) {
          // Protetor de cabo nao vira "em_evento" nem zera estoque: continua
          // disponivel para novas saidas (controle so pela quantidade na OS).
          if (materialPorQuantidade(item)) continue
          const matRef = doc(db, 'materiais', item.id)
          tx.update(matRef, {
            status: 'em_evento',
            eventoAtual: eventoIdFinal,
            estoqueAtual: 0,
          })
        }

        const localEvento = evento
          ? `${evento.nome}${evento.local ? ' · ' + evento.local : ''}`
          : 'Em evento'
        for (const gg of (geradores || [])) {
          const ggRef = doc(db, 'geradores', gg.id)
          tx.update(ggRef, {
            status: 'em_evento',
            eventoAtual: eventoIdFinal,
            eventoNome: evento?.nome || null,
            localizacao: localEvento,
          })
        }
      })

      setNumeroOrdem(formatarNumeroOrdem(novoNumero))
      setStatus('sucesso')
    } catch (err) {
      console.error(err)
      setErro(err.message || 'Erro ao confirmar saída.')
      setProgresso(null)
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
                Você está saindo com <strong>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</strong>
                {evento ? ` para o evento ${evento.nome}` : ''}
                {codigosGeradores ? ` — geradores: ${codigosGeradores}` : ''}.
                Esta ação atualizará o estoque em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm text-gray-700">Fotos (opcional)</h3>
              <p className="text-xs text-gray-400">Anexe fotos dos materiais ou do romaneio.</p>
            </div>
            {fotos.length > 0 && (
              <span className="bg-brand-red text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
              </span>
            )}
          </div>

          {fotos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {fotos.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                  <img src={f.preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removerFoto(idx)}
                    disabled={status === 'carregando'}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-brand-red text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={adicionarFotos}
            className="hidden"
          />
          <button
            onClick={() => fotoInputRef.current?.click()}
            disabled={status === 'carregando'}
            className="btn-secondary w-full justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {fotos.length > 0 ? 'Adicionar mais fotos' : 'Adicionar fotos'}
          </button>
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
              {progresso ? `Enviando foto ${progresso.atual}/${progresso.total}...` : 'Processando...'}
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
