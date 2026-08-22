import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  runTransaction,
  doc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { formatarNumeroOrdem, materialPorQuantidade } from '../../../utils/formatters'
import { materialContado, patchSaidaEvento, estoqueDe } from '../../estoque/contagem'
import { comprimirParaDataUrl } from '../../../utils/imagem'
import { gerarDeclaracaoSublocacao } from '../../../utils/declaracaoSublocacao'
import SignaturePad from '../../ui/SignaturePad'
import FotoPickerBotoes from '../../ui/FotoPickerBotoes'

export default function StepConfirmacao({ evento, geradores, itens, observacoes, responsavel, onNovaSaida }) {
  const { uid, nome } = useAuth()
  const [status, setStatus] = useState('idle')
  const [numeroOrdem, setNumeroOrdem] = useState(null)
  const [erro, setErro] = useState('')
  const [fotos, setFotos] = useState([])
  const [progresso, setProgresso] = useState(null) // { atual, total } durante o envio
  const [assinaturaEntregou, setAssinaturaEntregou] = useState('')
  const [assinaturaRecebeu, setAssinaturaRecebeu] = useState('')
  const [tokenGerado, setTokenGerado] = useState(null)
  const [recebeuPendente, setRecebeuPendente] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // libera as URLs de preview da memoria quando o componente desmonta
  useEffect(() => {
    return () => fotos.forEach(f => URL.revokeObjectURL(f.preview))
  }, [fotos])

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

  const codigosGeradores = geradores?.length > 0
    ? geradores.map(g => g.codigo).join(', ')
    : null

  // Locacao mensal e sublocacao: mesmo fluxo do evento, mas o gerador assume um
  // status proprio ('locacao' roxo / 'sublocado' verde-azulado) em vez de
  // 'em_evento', para separar as tres modalidades na frota.
  const ehLocacao = evento?.tipo === 'locacao_mensal'
  const ehSublocacao = evento?.tipo === 'sublocacao'
  const rotuloTipo = ehSublocacao ? 'a sublocação' : ehLocacao ? 'a locação' : 'o evento'
  const statusGerador = ehSublocacao ? 'sublocado' : ehLocacao ? 'locacao' : 'em_evento'
  const rotuloStatusGerador = ehSublocacao ? 'Sublocado' : 'Em Locação'

  async function confirmarSaida() {
    // Sublocação: o material sai com gente de fora, então a assinatura de quem
    // retira é colhida no balcão, antes de o equipamento deixar a empresa.
    // O link continua existindo para os outros casos e para correção posterior.
    if (ehSublocacao && !assinaturaRecebeu) {
      setErro('Na sublocação, quem retira precisa assinar antes de sair com o material.')
      setStatus('erro')
      return
    }
    setStatus('carregando')
    setErro('')
    try {
      const contadorRef = doc(db, 'contadores', 'ordens_saida')
      const ordemRef = doc(collection(db, 'ordens_saida'))
      const assinaturaRef = doc(collection(db, 'assinaturas_saida'))
      const tokenAssinatura = assinaturaRef.id
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

        // Guarda o doc lido para calcular a baixa na hora de escrever: material
        // contado (alambrado) desconta a quantidade em vez de ir inteiro.
        const lidos = {}
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
          if (materialContado(matData)) {
            const pedido = Math.max(1, Number(item.quantidade) || 1)
            if (pedido > estoqueDe(matData)) {
              throw new Error(`${item.nome}: só há ${estoqueDe(matData)} em estoque.`)
            }
          }
          lidos[item.id] = matData
        }

        // Cria o evento agora, dentro da transacao: so passa a existir se a
        // saida for confirmada. Voltar/abandonar o fluxo nao grava nada.
        let eventoIdFinal = evento?.id || null
        if (evento?.novo) {
          const eventoRef = doc(collection(db, 'eventos'))
          eventoIdFinal = eventoRef.id
          tx.set(eventoRef, {
            nome: evento.nome || null,
            local: evento.local || null,
            data: evento.data || null,
            status: evento.status || 'ativo',
            ...(evento.tipo ? { tipo: evento.tipo } : {}),
            ...(evento.previsaoDevolucao ? { previsaoDevolucao: evento.previsaoDevolucao } : {}),
            ...(ehSublocacao ? {
              retiradoPor: evento.retiradoPor || null,
              retiradoDocumento: evento.retiradoDocumento || null,
              retiradoTelefone: evento.retiradoTelefone || null,
              empresaCnpj: evento.empresaCnpj || null,
            } : {}),
            criadoEm: serverTimestamp(),
          })
        }

        tx.set(ordemRef, {
          numero: novoNumero,
          numeroFormatado: formatarNumeroOrdem(novoNumero),
          eventoId: eventoIdFinal,
          eventoNome: evento?.nome || null,
          ...(evento?.tipo ? { tipo: evento.tipo } : {}),
          ...(evento?.previsaoDevolucao ? { previsaoDevolucao: evento.previsaoDevolucao } : {}),
          ...(ehSublocacao ? {
            retiradoPor: evento.retiradoPor || null,
            retiradoDocumento: evento.retiradoDocumento || null,
            retiradoTelefone: evento.retiradoTelefone || null,
          } : {}),
          qtdFotos: fotos.length,
          tokenAssinatura: tokenAssinatura,
          assinaturaStatus: assinaturaRecebeu ? 'assinada' : 'pendente',
          geradores: (geradores || []).map(g => ({ id: g.id || null, codigo: g.codigo || null })),
          geradorCodigo: geradores?.length > 0 ? (geradores[0].codigo || null) : null,
          itens: itens.map(i => ({
            id: i.id || null,
            nome: i.nome || null,
            codigo: i.codigo || null,
            categoria: i.categoria || null,
            ...((materialPorQuantidade(i) || materialContado(i)) ? { quantidade: i.quantidade || 1 } : {}),
          })),
          observacoes: observacoes || null,
          responsavelNome: responsavel || null,
          operadorUid: uid || null,
          operadorNome: nome || null,
          status: 'ativo',
          criadoEm: serverTimestamp(),
        })

        tx.set(contadorRef, { ultimo: novoNumero }, { merge: true })

        for (const item of itens) {
          // Protetor de cabo nao vira "em_evento" nem zera estoque: continua
          // disponivel para novas saidas (controle so pela quantidade na OS).
          if (materialPorQuantidade(item)) continue
          tx.update(
            doc(db, 'materiais', item.id),
            patchSaidaEvento(lidos[item.id], item.quantidade || 1, eventoIdFinal),
          )
        }

        const localEvento = evento
          ? `${evento.nome}${evento.local ? ' · ' + evento.local : ''}`
          : (ehSublocacao ? 'Sublocado' : ehLocacao ? 'Em locação' : 'Em evento')
        for (const gg of (geradores || [])) {
          const ggRef = doc(db, 'geradores', gg.id)
          tx.update(ggRef, {
            status: statusGerador,
            eventoAtual: eventoIdFinal,
            eventoNome: evento?.nome || null,
            localizacao: localEvento,
          })
        }
      })

      // Cria o documento de assinatura (capability URL) com o resumo da OS.
      // Guarda a assinatura de quem entregou (coletada agora) e a de quem recebeu
      // se ja assinou aqui; senao fica pendente para assinar por link/presencial.
      await setDoc(assinaturaRef, {
        ordemId: ordemRef.id,
        numeroFormatado: formatarNumeroOrdem(novoNumero),
        eventoNome: evento?.nome || null,
        ...(evento?.tipo ? { tipo: evento.tipo } : {}),
        ...(ehSublocacao ? {
          retiradoDocumento: evento.retiradoDocumento || null,
          retiradoTelefone: evento.retiradoTelefone || null,
        } : {}),
        local: evento?.local || null,
        dataEvento: evento?.data || null,
        itens: itens.map(i => ({
          nome: i.nome || null,
          codigo: i.codigo || null,
          ...((materialPorQuantidade(i) || materialContado(i)) ? { quantidade: i.quantidade || 1 } : {}),
        })),
        entregouNome: nome || null,
        entregouAssinatura: assinaturaEntregou || null,
        recebeuNome: responsavel || null,
        recebeuAssinatura: assinaturaRecebeu || null,
        status: assinaturaRecebeu ? 'assinada' : 'pendente',
        criadoEm: serverTimestamp(),
        assinadoEm: assinaturaRecebeu ? serverTimestamp() : null,
      })

      setTokenGerado(tokenAssinatura)
      setRecebeuPendente(!assinaturaRecebeu)
      setNumeroOrdem(formatarNumeroOrdem(novoNumero))
      setStatus('sucesso')
    } catch (err) {
      console.error(err)
      const detalhe = err?.code ? `${err.message} (${err.code})` : err?.message
      setErro(detalhe || 'Erro ao confirmar saída.')
      setProgresso(null)
      setStatus('erro')
    }
  }

  // Mostra o formulario em qualquer estado que nao seja sucesso (idle, carregando
  // e tambem erro). No erro, o banner abaixo exibe a mensagem e o botao reabilita
  // para tentar de novo — antes o estado 'erro' caia no `return null` e deixava a
  // tela em branco, escondendo o motivo da falha.
  if (status !== 'sucesso') {
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
                {evento ? ` para ${rotuloTipo} ${evento.nome}` : ''}
                {codigosGeradores ? ` — geradores: ${codigosGeradores}` : ''}.
                Esta ação atualizará o estoque em tempo real.
                {(ehLocacao || ehSublocacao) && codigosGeradores && ` Os geradores ficarão com status ${rotuloStatusGerador}.`}
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

          <FotoPickerBotoes onArquivos={adicionarFotos} disabled={status === 'carregando'} />
        </div>

        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-gray-700">Assinaturas</h3>
            <p className="text-xs text-gray-400">
              Quem entrega assina agora. Quem recebe pode assinar agora (se presente) ou depois,
              por link/presencialmente.
            </p>
          </div>
          <SignaturePad
            titulo={`Quem entregou${nome ? ` — ${nome}` : ''}`}
            valor={assinaturaEntregou}
            onChange={setAssinaturaEntregou}
            altura={120}
          />
          <SignaturePad
            titulo={`Quem recebeu${responsavel ? ` — ${responsavel}` : ''}${ehSublocacao ? ' *' : ' (opcional)'}`}
            valor={assinaturaRecebeu}
            onChange={setAssinaturaRecebeu}
            altura={120}
          />
          {ehSublocacao && !assinaturaRecebeu && (
            <p className="text-xs text-brand-red bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Na sublocação a assinatura de quem retira é <strong>obrigatória</strong>: o material
              não sai da empresa sem ela. Peça para assinar na tela antes de confirmar.
            </p>
          )}
          {!ehSublocacao && !assinaturaRecebeu && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Sem a assinatura de quem recebeu, a saída fica <strong>pendente</strong> e um link
              será gerado para o recebedor assinar no evento.
            </p>
          )}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <button
          onClick={confirmarSaida}
          disabled={status === 'carregando' || (ehSublocacao && !assinaturaRecebeu)}
          className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
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

        {recebeuPendente && tokenGerado && (() => {
          const link = `${window.location.origin}/assinar/${tokenGerado}`
          const msg = `Confirme o recebimento do material da SOS Energia assinando aqui: ${link}`
          return (
            <div className="card text-left max-w-md mx-auto space-y-3">
              <div>
                <p className="font-semibold text-sm text-brand-black">Falta a assinatura de quem recebeu</p>
                <p className="text-xs text-gray-500 mt-0.5">Envie o link para {responsavel || 'o recebedor'} assinar no evento.</p>
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
          )
        })()}

        {ehSublocacao && (
          <div className="card text-left max-w-md mx-auto">
            <p className="font-semibold text-sm text-brand-black">Declaração de Entrega</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">
              O documento que a outra empresa assina ao retirar. Já sai com as assinaturas
              coletadas agora; o que faltar vira linha para preencher à mão.
            </p>
            <button
              onClick={() => gerarDeclaracaoSublocacao(
                evento,
                // a ordem ainda não voltou do banco: monta com o que acabou de ser gravado
                [{ numeroFormatado: numeroOrdem, geradores, itens }],
                {
                  entregouNome: nome,
                  entregouAssinatura: assinaturaEntregou || null,
                  recebeuNome: responsavel,
                  recebeuAssinatura: assinaturaRecebeu || null,
                },
              )}
              className="btn-secondary w-full justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Imprimir declaração
            </button>
          </div>
        )}

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
