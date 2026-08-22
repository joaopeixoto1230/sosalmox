import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { runTransaction, doc, collection, addDoc, setDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useFirestore'
import { OPERADORES } from '../../../utils/operadores'
import { formatarNumeroOrdem, materialPorQuantidade } from '../../../utils/formatters'
import { materialContado, patchSaida, estoqueDe } from '../../estoque/contagem'
import { comprimirParaDataUrl } from '../../../utils/imagem'
import DatePicker from '../../ui/DatePicker'
import FotoPickerBotoes from '../../ui/FotoPickerBotoes'
import SignaturePad from '../../ui/SignaturePad'
import { gerarRelatorioUsoInterno } from '../../../utils/relatorioUsoInterno'

// Fluxo de Uso Interno da Saida de Material. Dois subtipos:
// - emprestimo: ferramenta/equipamento que DEVE voltar (statusEmprestimo pendente,
//   devolucao gravada depois no proprio doc da ordem — ver view Ferramentas em Campo).
// - consumo: material que NAO volta (baixa definitiva de estoque quando cadastrado).
// Grava em ordens_saida com tipo:'uso_interno' (historico unificado com o Evento).
// Item nao cadastrado (avulso) nao mexe em estoque. Fotos: base64 em fotos_saida.

const MOTIVOS_CONSUMO = ['Teste', 'Uso da Equipe', 'Reposição de Kit', 'Outro']
const UNIDADES = ['un', 'm', 'kg', 'l', 'cx']

export default function UsoInternoFlow({ onTrocarTipo }) {
  const { uid, nome } = useAuth()
  const { dados: materiais } = useCollection('materiais')
  const { dados: ordens } = useCollection('ordens_saida')

  const [subtipo, setSubtipo] = useState(null) // emprestimo | consumo
  const [responsavel, setResponsavel] = useState('')
  const [outroResp, setOutroResp] = useState('')
  const [mostrarOutro, setMostrarOutro] = useState(false)
  const [dataPrevista, setDataPrevista] = useState('')
  const [destinoMotivo, setDestinoMotivo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [itens, setItens] = useState([]) // cadastrado {id,...} | avulso {avulso:true, tempId, nome, quantidade, unidade}
  const [fotos, setFotos] = useState([]) // { file, preview }
  const [busca, setBusca] = useState('')
  const [avulsoAberto, setAvulsoAberto] = useState(false)

  const [status, setStatus] = useState('idle') // idle | carregando | sucesso | erro
  const [erro, setErro] = useState('')
  const [progresso, setProgresso] = useState(null)
  const [numeroOrdem, setNumeroOrdem] = useState(null)

  // Assinaturas (mesmo padrao da saida externa: entregou assina agora, recebeu
  // pode assinar agora ou depois por link /assinar/:token).
  const [assinaturaEntregou, setAssinaturaEntregou] = useState('')
  const [assinaturaRecebeu, setAssinaturaRecebeu] = useState('')
  const [tokenGerado, setTokenGerado] = useState(null)
  const [recebeuPendente, setRecebeuPendente] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Anexar a uma saida ja feita hoje pelo mesmo responsavel (nao cria ordem nova).
  const [usarExistente, setUsarExistente] = useState(false)
  const [ordemCriada, setOrdemCriada] = useState(null) // dados p/ relatorio no sucesso

  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.preview)), [fotos])

  const responsavelFinal = mostrarOutro ? outroResp.trim() : responsavel

  // Saida interna ja feita HOJE pelo mesmo responsavel e subtipo — oferece anexar
  // os itens a ela em vez de criar ordem nova (pessoa que volta pra pegar mais).
  const ordemDoDia = useMemo(() => {
    if (!subtipo || !responsavelFinal) return null
    const hoje = new Date().toDateString()
    return ordens.find(o => {
      if (o.tipo !== 'uso_interno' || o.subtipo !== subtipo) return false
      if ((o.responsavelNome || '').trim().toLowerCase() !== responsavelFinal.trim().toLowerCase()) return false
      if (subtipo === 'emprestimo' && (o.statusEmprestimo || 'pendente') !== 'pendente') return false
      // criadoEm pendente (serverTimestamp ainda nao confirmado pelo servidor) =
      // doc criado agora mesmo nesta sessao — conta como hoje.
      if (!o.criadoEm) return true
      const d = o.criadoEm?.toDate?.()
      return d && d.toDateString() === hoje
    }) || null
  }, [ordens, subtipo, responsavelFinal])

  // `anexando` so vale com a ordem do dia presente — se ela sumir (responsavel
  // trocado, devolucao registrada), o checkbox orfao deixa de ter efeito sozinho.
  const anexando = usarExistente && !!ordemDoDia

  const disponiveis = useMemo(() => {
    if (!busca.trim()) return []
    const q = busca.toLowerCase()
    return materiais
      .filter(m => m.status === 'disponivel')
      .filter(m => m.nome?.toLowerCase().includes(q) || m.codigo?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [materiais, busca])

  function adicionarCadastrado(m) {
    if (itens.some(i => i.id === m.id)) return
    setItens(prev => [...prev, (materialPorQuantidade(m) || materialContado(m)) ? { ...m, quantidade: 1 } : m])
    setBusca('')
  }

  function adicionarAvulso(dados) {
    setItens(prev => [...prev, { avulso: true, tempId: crypto.randomUUID?.() || String(Date.now() + Math.random()), ...dados }])
    setAvulsoAberto(false)
  }

  function removerItem(chave) {
    setItens(prev => prev.filter(i => (i.avulso ? i.tempId : i.id) !== chave))
  }

  function setQuantidade(chave, q) {
    const n = Math.max(1, Number(q) || 1)
    setItens(prev => prev.map(i => (i.avulso ? i.tempId : i.id) === chave ? { ...i, quantidade: n } : i))
  }

  function adicionarFotos(arquivos) {
    if (!arquivos?.length) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function removerFoto(idx) {
    setFotos(prev => {
      const f = prev[idx]
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // Item contado não pode sair em quantidade maior do que a prateleira tem.
  // A transaction também barra, mas travar o botão evita chegar até lá.
  const algumPassouDoEstoque = itens.some(
    it => !it.avulso && materialContado(it) && (Number(it.quantidade) || 1) > estoqueDe(it),
  )

  const podeConfirmar =
    !!responsavelFinal &&
    itens.length > 0 &&
    !algumPassouDoEstoque &&
    (anexando ? true : (subtipo === 'emprestimo' ? !!dataPrevista : !!motivo))

  // Retrato do item gravado na ordem e no doc de assinatura.
  function itemParaOrdem(it) {
    return it.avulso
      ? { avulso: true, id: null, codigo: null, nome: it.nome, quantidade: it.quantidade || 1, unidade: it.unidade || 'un' }
      : {
        id: it.id,
        nome: it.nome || null,
        codigo: it.codigo || null,
        categoria: it.categoria || null,
        ...((materialPorQuantidade(it) || materialContado(it)) ? { quantidade: it.quantidade || 1 } : {}),
      }
  }

  function itemParaAssinatura(it) {
    return {
      nome: it.nome || null,
      codigo: it.codigo || null,
      ...((it.avulso || materialPorQuantidade(it) || materialContado(it)) ? { quantidade: it.quantidade || 1 } : {}),
    }
  }

  async function confirmar() {
    if (!podeConfirmar) return
    setStatus('carregando')
    setErro('')
    try {
      // Anexando: reusa a ordem do dia; senao cria ordem nova + doc de assinatura
      // (capability URL, mesmo padrao do StepConfirmacao da saida externa).
      const appendEm = anexando ? ordemDoDia : null
      const ordemRef = appendEm ? doc(db, 'ordens_saida', appendEm.id) : doc(collection(db, 'ordens_saida'))
      const contadorRef = doc(db, 'contadores', 'ordens_saida')
      const assinaturaRef = appendEm ? null : doc(collection(db, 'assinaturas_saida'))
      const tokenAssinatura = assinaturaRef?.id || null

      // Fotos primeiro (base64 em fotos_saida, momento 'saida') — mesmo padrao da Saida/OS.
      if (fotos.length > 0) {
        for (let i = 0; i < fotos.length; i++) {
          setProgresso({ atual: i + 1, total: fotos.length })
          const dataUrl = await comprimirParaDataUrl(fotos[i].file)
          await addDoc(collection(db, 'fotos_saida'), {
            ordemId: ordemRef.id,
            ordem: i,
            dataUrl,
            momento: 'saida',
            criadoPor: uid,
            criadoPorNome: nome,
            criadoEm: serverTimestamp(),
          })
        }
        setProgresso(null)
      }

      let novoNumero
      let resultado = null // dados finais da ordem p/ tela de sucesso e relatorio
      await runTransaction(db, async (tx) => {
        // ===== LEITURAS (todas antes de qualquer escrita) =====
        let dadosExistente = null
        let assRefExistente = null
        let assinaturaExistente = null
        if (appendEm) {
          const snap = await tx.get(ordemRef)
          if (!snap.exists()) throw new Error('A saída original não existe mais.')
          dadosExistente = snap.data()
          if (dadosExistente.tokenAssinatura) {
            assRefExistente = doc(db, 'assinaturas_saida', dadosExistente.tokenAssinatura)
            const aSnap = await tx.get(assRefExistente)
            assinaturaExistente = aSnap.exists() ? aSnap.data() : null
          }
        } else {
          const contSnap = await tx.get(contadorRef)
          novoNumero = (contSnap.exists() ? contSnap.data().ultimo : 0) + 1
        }

        const cadastrados = itens.filter(it => !it.avulso && !materialPorQuantidade(it))
        // Guarda o doc lido para calcular a baixa na hora de escrever: item
        // contado (fita, parafuso) desconta a quantidade em vez de zerar.
        const lidos = {}
        for (const it of cadastrados) {
          const snap = await tx.get(doc(db, 'materiais', it.id))
          if (!snap.exists()) throw new Error(`Material ${it.nome} não encontrado.`)
          const dados = snap.data()
          if (dados.status !== 'disponivel') throw new Error(`${it.nome} não está mais disponível.`)
          if (materialContado(dados)) {
            const pedido = Math.max(1, Number(it.quantidade) || 1)
            if (pedido > estoqueDe(dados)) {
              throw new Error(`${it.nome}: só há ${estoqueDe(dados)} em estoque.`)
            }
          }
          lidos[it.id] = dados
        }

        // ===== ESCRITAS =====
        const novosItens = itens.map(itemParaOrdem)
        if (appendEm) {
          const itensFinais = [...(dadosExistente.itens || []), ...novosItens]
          tx.update(ordemRef, {
            itens: itensFinais,
            qtdFotos: (dadosExistente.qtdFotos || 0) + fotos.length,
          })
          // Mantem o doc de assinatura em dia para o link/relatorio mostrarem tudo.
          if (assRefExistente && assinaturaExistente) {
            tx.update(assRefExistente, {
              itens: [...(assinaturaExistente.itens || []), ...itens.map(itemParaAssinatura)],
            })
          }
          resultado = { id: appendEm.id, ...dadosExistente, itens: itensFinais }
        } else {
          tx.set(ordemRef, {
            numero: novoNumero,
            numeroFormatado: formatarNumeroOrdem(novoNumero),
            tipo: 'uso_interno',
            subtipo,
            eventoId: null,
            eventoNome: null,
            geradores: [],
            geradorCodigo: null,
            itens: novosItens,
            responsavelNome: responsavelFinal,
            observacoes: null,
            qtdFotos: fotos.length,
            tokenAssinatura,
            assinaturaStatus: assinaturaRecebeu ? 'assinada' : 'pendente',
            operadorUid: uid || null,
            operadorNome: nome || null,
            status: 'ativo',
            criadoEm: serverTimestamp(),
            ...(subtipo === 'emprestimo'
              ? {
                dataPrevistaDevolucao: dataPrevista,
                destinoMotivo: destinoMotivo.trim() || null,
                statusEmprestimo: 'pendente',
              }
              : {
                motivo,
              }),
          })

          tx.set(contadorRef, { ultimo: novoNumero }, { merge: true })
        }

        // Baixa de estoque dos itens CADASTRADOS (avulso e por-quantidade nao mexem).
        // Item contado desconta a quantidade; item de unidade sai inteiro.
        for (const it of cadastrados) {
          tx.update(
            doc(db, 'materiais', it.id),
            patchSaida(lidos[it.id], it.quantidade || 1, subtipo),
          )
        }
      })

      if (appendEm) {
        setNumeroOrdem(appendEm.numeroFormatado)
        setTokenGerado(resultado?.tokenAssinatura || null)
        setRecebeuPendente(!!resultado?.tokenAssinatura && (resultado?.assinaturaStatus || 'pendente') === 'pendente')
        setOrdemCriada(resultado)
      } else {
        // Doc de assinatura fora da transaction (mesmo padrao do StepConfirmacao).
        await setDoc(assinaturaRef, {
          ordemId: ordemRef.id,
          numeroFormatado: formatarNumeroOrdem(novoNumero),
          eventoNome: subtipo === 'emprestimo' ? 'Uso interno — Empréstimo' : 'Uso interno — Consumo',
          local: subtipo === 'emprestimo' ? (destinoMotivo.trim() || null) : (motivo || null),
          dataEvento: null,
          itens: itens.map(itemParaAssinatura),
          entregouNome: nome || null,
          entregouAssinatura: assinaturaEntregou || null,
          recebeuNome: responsavelFinal || null,
          recebeuAssinatura: assinaturaRecebeu || null,
          status: assinaturaRecebeu ? 'assinada' : 'pendente',
          criadoEm: serverTimestamp(),
          assinadoEm: assinaturaRecebeu ? serverTimestamp() : null,
        })

        const numeroFmt = formatarNumeroOrdem(novoNumero)
        setNumeroOrdem(numeroFmt)
        setTokenGerado(tokenAssinatura)
        setRecebeuPendente(!assinaturaRecebeu)
        setOrdemCriada({
          id: ordemRef.id,
          numeroFormatado: numeroFmt,
          tipo: 'uso_interno',
          subtipo,
          responsavelNome: responsavelFinal,
          operadorNome: nome,
          criadoEm: new Date(),
          itens: itens.map(itemParaOrdem),
          ...(subtipo === 'emprestimo'
            ? { dataPrevistaDevolucao: dataPrevista, destinoMotivo: destinoMotivo.trim() || null }
            : { motivo }),
        })
      }
      setStatus('sucesso')
    } catch (err) {
      console.error(err)
      const detalhe = err?.code ? `${err.message} (${err.code})` : err?.message
      setErro(detalhe || 'Erro ao registrar saída.')
      setProgresso(null)
      setStatus('erro')
    }
  }

  async function imprimirRelatorio() {
    if (!ordemCriada) return
    // Busca as fotos da ordem (fotos_saida) para sairem no relatorio.
    let fotosOrdem = []
    if (ordemCriada.id) {
      try {
        const snap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', '==', ordemCriada.id)))
        fotosOrdem = snap.docs.map(d => d.data()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      } catch (e) { console.error(e) }
    }
    gerarRelatorioUsoInterno(ordemCriada, {
      entregouNome: ordemCriada.operadorNome || nome || null,
      recebeuNome: ordemCriada.responsavelNome || null,
      entregouAssinatura: assinaturaEntregou || null,
      recebeuAssinatura: assinaturaRecebeu || null,
    }, fotosOrdem)
  }

  function novaSaida() {
    fotos.forEach(f => URL.revokeObjectURL(f.preview))
    setSubtipo(null)
    setResponsavel(''); setOutroResp(''); setMostrarOutro(false)
    setDataPrevista(''); setDestinoMotivo(''); setMotivo('')
    setItens([]); setFotos([]); setBusca('')
    setStatus('idle'); setErro(''); setNumeroOrdem(null)
    setAssinaturaEntregou(''); setAssinaturaRecebeu('')
    setTokenGerado(null); setRecebeuPendente(false); setLinkCopiado(false)
    setUsarExistente(false); setOrdemCriada(null)
  }

  // ---- Sucesso ----
  if (status === 'sucesso') {
    const link = tokenGerado ? `${window.location.origin}/assinar/${tokenGerado}` : null
    const msg = link ? `Confirme o recebimento do material da SOS Energia assinando aqui: ${link}` : ''
    return (
      <div className="text-center py-8 space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-brand-black">
            {subtipo === 'emprestimo' ? 'Empréstimo registrado!' : 'Consumo registrado!'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">Saída interna gerada com sucesso.</p>
          <div className="inline-block bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-lg px-6 py-2 rounded-xl mt-3">
            {numeroOrdem}
          </div>
        </div>

        {recebeuPendente && link && (
          <div className="card text-left max-w-md mx-auto space-y-3">
            <div>
              <p className="font-semibold text-sm text-brand-black">Falta a assinatura de quem recebeu</p>
              <p className="text-xs text-gray-500 mt-0.5">Envie o link para {ordemCriada?.responsavelNome || 'o responsável'} assinar.</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-600 font-mono truncate flex-1">{link}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(link); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2000) }}
                className="text-xs font-semibold text-brand-red flex-shrink-0"
              >
                {linkCopiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zM17.41 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
              </svg>
              Enviar pelo WhatsApp
            </a>
          </div>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={novaSaida} className="btn-primary">Nova saída interna</button>
          <button onClick={imprimirRelatorio} className="btn-secondary gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir relatório
          </button>
          {subtipo === 'emprestimo' && (
            <Link to="/uso-interno" className="btn-secondary">Ferramentas em Campo</Link>
          )}
          <Link to="/estoque" className="btn-secondary">Ver Estoque</Link>
        </div>
      </div>
    )
  }

  // ---- Escolha do subtipo ----
  if (!subtipo) {
    return (
      <div className="space-y-4">
        <button onClick={onTrocarTipo} className="text-sm text-gray-500 hover:text-brand-red inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Trocar tipo de saída
        </button>
        <div>
          <h2 className="text-lg font-bold text-brand-black">Uso Interno</h2>
          <p className="text-sm text-gray-500">Escolha o que está saindo.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={() => setSubtipo('emprestimo')} className="card text-left hover:border-brand-red hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4m-6 4l3-3 3 3m-3-3v-8" />
              </svg>
            </div>
            <p className="font-bold text-brand-black">Empréstimo</p>
            <p className="text-sm text-gray-500 mt-0.5">Ferramenta/equipamento que deve voltar. Entra em "Ferramentas em Campo".</p>
          </button>
          <button onClick={() => setSubtipo('consumo')} className="card text-left hover:border-brand-red hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <p className="font-bold text-brand-black">Consumo</p>
            <p className="text-sm text-gray-500 mt-0.5">Material que não volta (fita, cabo de teste, parafuso). Baixa definitiva.</p>
          </button>
        </div>
      </div>
    )
  }

  // ---- Formulario ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-brand-black">
            Uso Interno · {subtipo === 'emprestimo' ? 'Empréstimo' : 'Consumo'}
          </h2>
          <p className="text-sm text-gray-500">
            {subtipo === 'emprestimo' ? 'Ferramenta/equipamento que deve voltar.' : 'Material que não volta — baixa definitiva.'}
          </p>
        </div>
        <button onClick={() => setSubtipo(null)} className="text-sm text-brand-red hover:underline flex-shrink-0">Trocar</button>
      </div>

      {/* Responsavel */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {subtipo === 'emprestimo' ? 'Responsável pela retirada *' : 'Responsável *'}
        </label>
        <div className="flex flex-wrap gap-2">
          {OPERADORES.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { setResponsavel(n); setMostrarOutro(false) }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                responsavel === n && !mostrarOutro ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-red hover:text-brand-red'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setMostrarOutro(true); setResponsavel('') }}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              mostrarOutro ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-red hover:text-brand-red'
            }`}
          >
            + Outro
          </button>
        </div>
        {mostrarOutro && (
          <input value={outroResp} onChange={e => setOutroResp(e.target.value)} placeholder="Digite o nome..." className="input mt-2" autoFocus />
        )}
      </div>

      {/* Já pegou material hoje: opção de anexar à saída existente */}
      {ordemDoDia && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            {responsavelFinal} já retirou {subtipo === 'emprestimo' ? 'empréstimo' : 'material'} hoje ({ordemDoDia.numeroFormatado})
          </p>
          <label className="flex items-start gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={usarExistente}
              onChange={e => setUsarExistente(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand-red flex-shrink-0"
            />
            <span className="text-sm text-amber-700">
              Adicionar os itens a essa saída, em vez de criar uma nova ordem.
            </span>
          </label>
        </div>
      )}

      {/* Campos por subtipo (ocultos ao anexar — herdam da ordem original) */}
      {!anexando && (
      <div className="card space-y-4">
        {subtipo === 'emprestimo' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data prevista de devolução *</label>
              <DatePicker value={dataPrevista} onChange={setDataPrevista} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destino / motivo</label>
              <input value={destinoMotivo} onChange={e => setDestinoMotivo(e.target.value)} placeholder="Ex: instalação cliente X" className="input" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_CONSUMO.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                    motivo === m ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-red hover:text-brand-red'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Itens */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Itens *</label>
          <button onClick={() => setAvulsoAberto(true)} className="text-xs font-semibold text-brand-red hover:underline inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Item não cadastrado
          </button>
        </div>

        <div className="relative">
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar material cadastrado por nome ou código..."
            className="input"
          />
          {disponiveis.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {disponiveis.map(m => (
                <button
                  key={m.id}
                  onClick={() => adicionarCadastrado(m)}
                  disabled={itens.some(i => i.id === m.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 disabled:opacity-40"
                >
                  <span className="text-sm text-brand-black truncate">{m.nome}</span>
                  <span className="text-xs text-gray-400 font-mono flex-shrink-0">{m.codigo}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {itens.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhum item ainda. Busque um cadastrado ou use "Item não cadastrado".</p>
        ) : (
          <div className="space-y-2">
            {itens.map(it => {
              const chave = it.avulso ? it.tempId : it.id
              const contado = !it.avulso && materialContado(it)
              const temQtd = it.avulso || materialPorQuantidade(it) || contado
              const passouDoEstoque = contado && (Number(it.quantidade) || 1) > estoqueDe(it)
              return (
                <div key={chave} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-black truncate">
                      {it.nome}
                      {it.avulso && <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">avulso</span>}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {it.avulso ? `${it.quantidade} ${it.unidade}` : it.codigo}
                      {contado && <span className="ml-2 font-sans">{estoqueDe(it)} em estoque</span>}
                    </p>
                  </div>
                  {temQtd && (
                    <input
                      type="number"
                      min="1"
                      // Item contado não pode sair mais do que existe na prateleira.
                      {...(contado ? { max: estoqueDe(it) } : {})}
                      value={it.quantidade || 1}
                      onChange={e => setQuantidade(chave, e.target.value)}
                      className={`input w-16 text-center py-1 ${passouDoEstoque ? 'border-brand-red' : ''}`}
                    />
                  )}
                  <button onClick={() => removerItem(chave)} className="text-gray-400 hover:text-brand-red flex-shrink-0" aria-label="Remover item">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fotos (opcional, botao sempre visivel) */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm text-gray-700">Fotos (opcional)</h3>
            <p className="text-xs text-gray-400">Foto do equipamento/material na saída.</p>
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
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
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
        <FotoPickerBotoes onArquivos={adicionarFotos} disabled={status === 'carregando'} />
      </div>

      {/* Assinaturas (mesmo padrao da saida externa). Ocultas ao anexar: a ordem
          original ja tem assinatura/link proprios. */}
      {!anexando && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-gray-700">Assinaturas</h3>
            <p className="text-xs text-gray-400">
              Quem entrega assina agora. Quem recebe pode assinar agora (se presente) ou depois, por link.
            </p>
          </div>
          <SignaturePad
            titulo={`Quem entregou${nome ? ` — ${nome}` : ''}`}
            valor={assinaturaEntregou}
            onChange={setAssinaturaEntregou}
            altura={120}
          />
          <SignaturePad
            titulo={`Quem recebeu${responsavelFinal ? ` — ${responsavelFinal}` : ''} (opcional)`}
            valor={assinaturaRecebeu}
            onChange={setAssinaturaRecebeu}
            altura={120}
          />
          {!assinaturaRecebeu && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Sem a assinatura de quem recebeu, um link será gerado para assinar depois (WhatsApp).
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{erro}</div>
      )}

      <button onClick={confirmar} disabled={!podeConfirmar || status === 'carregando'} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
        {status === 'carregando' ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {progresso ? `Enviando foto ${progresso.atual}/${progresso.total}...` : 'Processando...'}
          </>
        ) : anexando ? `Adicionar à ${ordemDoDia.numeroFormatado}` : `Confirmar ${subtipo === 'emprestimo' ? 'Empréstimo' : 'Consumo'}`}
      </button>

      {avulsoAberto && <ItemAvulsoModal onFechar={() => setAvulsoAberto(false)} onAdicionar={adicionarAvulso} />}
    </div>
  )
}

function ItemAvulsoModal({ onFechar, onAdicionar }) {
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [unidade, setUnidade] = useState('un')

  function salvar() {
    if (!nome.trim()) return
    onAdicionar({ nome: nome.trim(), quantidade: Math.max(1, Number(quantidade) || 1), unidade })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Item não cadastrado</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome do item *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Broca 8mm, Fita isolante..." className="input" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Quantidade</label>
              <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Unidade</label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)} className="input">
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            💡 Recomendado: adicione uma <strong>foto</strong> deste item na seção de fotos abaixo — ajuda a decidir depois se ele merece virar cadastro oficial.
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={!nome.trim()} className="btn-primary flex-1 disabled:opacity-50">Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
