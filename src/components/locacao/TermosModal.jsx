import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, getDocs, getDoc,
  doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import SignaturePad from '../ui/SignaturePad'
import { linkWhatsApp } from '../../utils/whatsapp'
import { gerarTermoLocacao } from '../../utils/termoLocacao'
import { itensDoTermo, geradoresDoTermo, resumoConferencia, TIPOS_TERMO } from './termos'

// Termos do cliente de uma locação: gerar o link, acompanhar quem já assinou e
// emitir o documento. Fica no menu ⋯ do card e no detalhe da locação.
//
// A ENTREGA já sai com a assinatura de quem entregou — vem da assinatura da
// própria ordem de saída, que o colaborador deu no lançamento. Quando não há
// (saída antiga, ou ninguém assinou), dá para assinar aqui na hora: sem isso o
// documento chegaria ao cliente com metade das assinaturas.
//
// A DEVOLUÇÃO nasce vazia dos dois lados: quem recolhe assina no local, junto
// com quem devolve, depois de conferir item a item.

export default function TermosModal({ evento, onFechar }) {
  const { uid, nome } = useAuth()
  const { dados: materiais } = useCollection('materiais')
  const [ordens, setOrdens] = useState([])
  const [termos, setTermos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(null) // 'entrega' | 'devolucao'
  const [assinaturaSOS, setAssinaturaSOS] = useState('')
  const [nomeSOS, setNomeSOS] = useState(nome || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  const materiaisMap = useMemo(() => {
    const m = {}
    materiais.forEach(mat => { m[mat.id] = mat })
    return m
  }, [materiais])

  useEffect(() => {
    let vivo = true
    async function carregar() {
      setCarregando(true)
      try {
        const [ordensSnap, termosSnap] = await Promise.all([
          getDocs(query(collection(db, 'ordens_saida'), where('eventoId', '==', evento.id))),
          getDocs(query(collection(db, 'termos_locacao'), where('eventoId', '==', evento.id))),
        ])
        if (!vivo) return
        setOrdens(ordensSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setTermos(
          termosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0)),
        )
      } catch (e) {
        console.error(e)
        if (vivo) setErro('Não foi possível carregar os termos.')
      } finally {
        if (vivo) setCarregando(false)
      }
    }
    carregar()
    return () => { vivo = false }
  }, [evento.id, versao])

  const itens = useMemo(() => itensDoTermo(ordens, materiaisMap), [ordens, materiaisMap])
  const geradores = useMemo(() => geradoresDoTermo(ordens), [ordens])

  // Assinatura de quem entregou, colhida no lançamento da saída. É ela que faz
  // o link de entrega já sair meio assinado.
  const [assinaturaDaOrdem, setAssinaturaDaOrdem] = useState(null)
  useEffect(() => {
    let vivo = true
    async function buscar() {
      // O id do doc de assinatura É o token guardado na ordem — busca direta.
      for (const ordem of ordens.filter(o => o.tokenAssinatura)) {
        try {
          const snap = await getDoc(doc(db, 'assinaturas_saida', ordem.tokenAssinatura))
          const d = snap.exists() ? snap.data() : null
          if (d?.entregouAssinatura && vivo) { setAssinaturaDaOrdem(d); return }
        } catch { /* não achar não impede assinar na hora */ }
      }
    }
    if (ordens.length > 0) buscar()
    return () => { vivo = false }
  }, [ordens])

  function abrirCriacao(tipo) {
    setErro('')
    setCriando(tipo)
    if (tipo === 'entrega') {
      setAssinaturaSOS(assinaturaDaOrdem?.entregouAssinatura || '')
      setNomeSOS(assinaturaDaOrdem?.entregouNome || nome || '')
    } else {
      setAssinaturaSOS('')
      setNomeSOS(nome || '')
    }
  }

  async function gerarLink() {
    if (itens.length === 0 && geradores.length === 0) {
      setErro('Esta locação não tem material lançado para colocar no termo.')
      return
    }
    if (criando === 'entrega' && !assinaturaSOS) {
      setErro('Assine como quem entregou — o cliente recebe o termo já com a sua assinatura.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const ref = doc(collection(db, 'termos_locacao'))
      await setDoc(ref, {
        tipo: criando,
        eventoId: evento.id,
        eventoNome: evento.nome || null,
        eventoTipo: evento.tipo || null,
        local: evento.local || null,
        dataEvento: evento.data || null,
        numeroFormatado: ordens.map(o => o.numeroFormatado).filter(Boolean).join(', ') || null,
        itens,
        geradores,
        // Na entrega a SOS já assinou; na devolução quem recolhe assina no link.
        sosNome: nomeSOS.trim() || null,
        sosAssinatura: criando === 'entrega' ? assinaturaSOS : null,
        clienteNome: null,
        clienteDocumento: null,
        clienteAssinatura: null,
        conferencia: {},
        observacoes: null,
        qtdFotos: 0,
        status: 'pendente',
        criadoPor: uid || null,
        criadoPorNome: nome || null,
        criadoEm: serverTimestamp(),
      })
      setCriando(null)
      setVersao(v => v + 1)
    } catch (e) {
      console.error(e)
      setErro(e.message || 'Não foi possível gerar o termo.')
      setSalvando(false)
      return
    }
    setSalvando(false)
  }

  async function excluirTermo(termo) {
    if (!window.confirm(
      termo.status === 'assinado'
        ? `Excluir o ${TIPOS_TERMO[termo.tipo]?.titulo || 'termo'} já assinado por ${termo.clienteNome || 'cliente'}? O documento deixa de existir.`
        : 'Excluir este termo pendente? O link enviado para de funcionar.',
    )) return
    try {
      await deleteDoc(doc(db, 'termos_locacao', termo.id))
      setVersao(v => v + 1)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível excluir.')
    }
  }

  async function imprimir(termo) {
    let fotos = []
    if (termo.qtdFotos > 0) {
      try {
        // Ordena em JS: `where` + `orderBy` exigiria índice composto, e o
        // resto do sistema (fotos_saida) segue o mesmo caminho.
        const snap = await getDocs(query(
          collection(db, 'fotos_termo'),
          where('termoId', '==', termo.id),
        ))
        fotos = snap.docs.map(d => d.data()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      } catch (e) {
        // Sem as fotos o termo ainda vale: as assinaturas é que fazem o documento.
        console.error(e)
      }
    }
    gerarTermoLocacao(termo, fotos)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-brand-black">Termos do cliente</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{evento.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {carregando ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : criando ? (
            <div className="space-y-4">
              <button
                onClick={() => { setCriando(null); setErro('') }}
                className="text-sm text-gray-500 hover:text-brand-black flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>

              <div>
                <h3 className="font-bold text-brand-black">{TIPOS_TERMO[criando].titulo}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {criando === 'entrega'
                    ? 'O cliente abre o link, confere a lista e assina com nome e CPF.'
                    : 'Quem for recolher abre o link no local, confere item a item, fotografa e colhe a assinatura de quem devolve.'}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Vai no termo ({itens.length + geradores.length})
                </p>
                <div className="space-y-1">
                  {geradores.map(g => (
                    <p key={g.codigo} className="text-xs text-gray-600">Gerador {g.codigo}</p>
                  ))}
                  {itens.map(i => (
                    <p key={i.chave} className="text-xs text-gray-600 truncate">
                      {i.nome}{i.quantidade > 1 ? ` · ${i.quantidade} un.` : ''}
                    </p>
                  ))}
                  {itens.length + geradores.length === 0 && (
                    <p className="text-xs text-gray-400">Nenhum material lançado nesta locação.</p>
                  )}
                </div>
              </div>

              {criando === 'entrega' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Quem entregou</label>
                    <input value={nomeSOS} onChange={e => setNomeSOS(e.target.value)} className="input" />
                  </div>
                  {assinaturaDaOrdem?.entregouAssinatura && assinaturaSOS === assinaturaDaOrdem.entregouAssinatura ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Assinatura de quem entregou</p>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-2 bg-white">
                        <img src={assinaturaSOS} alt="Assinatura" className="h-16 mx-auto object-contain" />
                      </div>
                      <button
                        onClick={() => setAssinaturaSOS('')}
                        className="text-xs font-semibold text-brand-red hover:underline mt-1.5 min-h-[40px]"
                      >
                        Assinar de novo
                      </button>
                      <p className="text-xs text-gray-400">Veio da assinatura do lançamento da saída.</p>
                    </div>
                  ) : (
                    <SignaturePad
                      titulo="Assinatura de quem entregou *"
                      valor={assinaturaSOS}
                      onChange={setAssinaturaSOS}
                      altura={150}
                    />
                  )}
                </div>
              )}

              {criando === 'devolucao' && (
                <p className="text-xs rounded-xl px-3 py-2 border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                  As duas assinaturas da devolução são colhidas no local, pelo link — a de quem
                  devolve e a de quem recolhe.
                </p>
              )}

              {erro && <p className="text-sm text-brand-red">{erro}</p>}

              <button
                onClick={gerarLink}
                disabled={salvando}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {salvando ? 'Gerando...' : 'Gerar link do termo'}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => abrirCriacao('entrega')} className="btn-secondary justify-center py-3">
                  + Entrega
                </button>
                <button onClick={() => abrirCriacao('devolucao')} className="btn-secondary justify-center py-3">
                  + Devolução
                </button>
              </div>

              {erro && <p className="text-sm text-brand-red">{erro}</p>}

              {termos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Nenhum termo gerado ainda.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    O termo de entrega vira o comprovante que vai ao cliente; o de devolução
                    registra o que voltou e o que faltou.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {termos.map(termo => (
                    <CardTermo
                      key={termo.id}
                      termo={termo}
                      evento={evento}
                      onImprimir={() => imprimir(termo)}
                      onExcluir={() => excluirTermo(termo)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button onClick={onFechar} className="btn-secondary w-full justify-center">Fechar</button>
        </div>
      </div>
    </div>
  )
}

function CardTermo({ termo, evento, onImprimir, onExcluir }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${window.location.origin}/termo/${termo.id}`
  const rotulos = TIPOS_TERMO[termo.tipo] || TIPOS_TERMO.entrega
  const assinado = termo.status === 'assinado'
  const { faltantes } = resumoConferencia(termo.itens || [], termo.conferencia || {})

  const msg = termo.tipo === 'entrega'
    ? `Confirme o recebimento do material da SOS Energia${evento?.nome ? ` (${evento.nome})` : ''} assinando aqui: ${link}`
    : `Termo de devolução do material da SOS Energia${evento?.nome ? ` (${evento.nome})` : ''}. Confira item a item e colha a assinatura: ${link}`
  // Sublocação guarda o telefone de quem retira; nos demais casos o WhatsApp
  // abre no seletor de contatos.
  const href = linkWhatsApp(evento?.retiradoTelefone || null, msg)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { window.prompt('Copie o link:', link) }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-brand-black">{rotulos.titulo}</p>
          <p className="text-xs text-gray-400">
            {termo.criadoEm?.toDate ? termo.criadoEm.toDate().toLocaleDateString('pt-BR') : '—'}
            {termo.itens?.length ? ` · ${termo.itens.length} itens` : ''}
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${assinado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {assinado ? 'Assinado' : 'Pendente'}
        </span>
      </div>

      {assinado && (
        <div className="text-xs text-gray-600 space-y-0.5">
          <p>
            <span className="text-gray-400">{termo.tipo === 'devolucao' ? 'Devolvido por:' : 'Recebido por:'}</span>{' '}
            <span className="font-medium text-brand-black">{termo.clienteNome}</span>
            {termo.clienteDocumento ? ` · ${termo.tipo === 'devolucao' ? 'RG' : 'CPF'} ${termo.clienteDocumento}` : ''}
          </p>
          {termo.tipo === 'devolucao' && (
            faltantes.length > 0
              ? <p className="text-brand-red font-medium">{faltantes.length} {faltantes.length === 1 ? 'item não devolvido' : 'itens não devolvidos'}</p>
              : <p className="text-green-700 font-medium">Tudo devolvido</p>
          )}
          {termo.qtdFotos > 0 && <p className="text-gray-400">{termo.qtdFotos} {termo.qtdFotos === 1 ? 'foto' : 'fotos'}</p>}
          {termo.observacoes && <p className="italic text-gray-500">"{termo.observacoes}"</p>}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {assinado ? (
          <button onClick={onImprimir} className="btn-primary flex-1 justify-center text-sm gap-2 min-w-[140px]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documento
          </button>
        ) : (
          <>
            <button onClick={copiar} className="btn-secondary flex-1 justify-center text-sm min-w-[100px]">
              {copiado ? 'Copiado!' : 'Copiar link'}
            </button>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 justify-center text-sm min-w-[100px]"
            >
              WhatsApp
            </a>
          </>
        )}
        <button
          onClick={onExcluir}
          className="btn-ghost text-sm text-brand-red px-3"
          title="Excluir termo"
        >
          Excluir
        </button>
      </div>
    </div>
  )
}
