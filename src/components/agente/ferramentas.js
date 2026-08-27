import { doc, getDoc, runTransaction, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { idsFiltrosIguais } from '../filtros/filtrosUtils'
import { criarSolicitacaoCompra } from '../../utils/notificacoes'
import { formatarNumeroOS } from '../../utils/formatters'
import { resolverAcao } from './acoesAgente'

export { ferramentasDoPerfil, instrucaoFerramentas } from './acoesAgente'

// ===== Ferramentas do agente que AGE — parte que GRAVA =====
//
// O agente monta a operação a partir do pedido em linguagem natural
// (acoesAgente.js, com testes), mas NADA é gravado sem o usuário clicar em
// Confirmar no chat. A execução roda AQUI, no navegador, com o login do
// próprio usuário — as regras do Firestore e os perfis continuam valendo;
// o proxy só faz a parte de conversa.
//
// Cada execução replica a MESMA transação da tela correspondente
// (BaixaFiltroModal, NovaOS). Se a tela mudar de regra, mudar aqui junto.

export function prepararAcao(nomeFerramenta, entrada, ctx) {
  const r = resolverAcao(nomeFerramenta, entrada, ctx)
  if (r.erro) return r
  const executores = {
    registrar_baixa_filtro: () => executarBaixaFiltro(r.dados, ctx),
    abrir_ordem_servico: () => executarAbrirOS(r.dados, ctx),
    iniciar_saida_material: () => executarIniciarSaida(r.dados, ctx),
  }
  return { ...r, executar: executores[nomeFerramenta] }
}

// Não grava nada: deixa o passo 1 pronto e leva o usuário para a tela de
// Saída, onde o fluxo segue normal (materiais, romaneio, assinaturas).
// sessionStorage porque o prefill é de uso único e morre com a aba.
async function executarIniciarSaida({ prefill }, { navegar }) {
  sessionStorage.setItem('agentePrefillSaida', JSON.stringify(prefill))
  navegar?.('/saida')
  return `Tela de Saída de Material aberta com o passo 1 preenchido (${prefill.nome}). O usuário continua de lá: materiais, romaneio e assinaturas.`
}

async function executarBaixaFiltro({ filtro, qtd, motivo }, { filtros, uid, nomeUsuario }) {
  // Mesma transação do BaixaFiltroModal: estoque compartilhado entre
  // filtros de mesma referência, registro em baixas_filtro.
  const iguaisIds = idsFiltrosIguais(filtros, filtro)
  let novaQtd = 0
  await runTransaction(db, async (tx) => {
    const refs = iguaisIds.map(id => doc(db, 'filtros', id))
    const snaps = await Promise.all(refs.map(r => tx.get(r)))
    const baseIdx = iguaisIds.indexOf(filtro.id)
    const atual = snaps[baseIdx]?.data()?.quantidadeAtual || 0
    if (qtd > atual) throw new Error(`Estoque mudou: agora há ${atual}.`)
    novaQtd = atual - qtd
    refs.forEach(r => tx.update(r, { quantidadeAtual: novaQtd }))
    tx.set(doc(collection(db, 'baixas_filtro')), {
      filtroId: filtro.id,
      filtroNome: filtro.nome,
      quantidade: qtd,
      motivo: motivo || 'Baixa via agente IA',
      aplicadoEmIguais: iguaisIds.length,
      operadorUid: uid,
      operadorNome: nomeUsuario,
      criadoEm: serverTimestamp(),
    })
  })
  if (novaQtd <= (filtro.estoqueMin || 0) && filtro.estoqueMin > 0) {
    await criarSolicitacaoCompra({ ...filtro, quantidadeAtual: novaQtd }).catch(() => {})
  }
  return `Baixa registrada: ${qtd}x ${filtro.nome}. Estoque agora: ${novaQtd}.`
}

async function executarAbrirOS({ equip, equipamentoTipo, label, foraComCliente, tipo, descricao, mecanico }, { uid, nomeUsuario }) {
  // Mesma transação da NovaOS, sem filtros (OS nasce pendente; filtros são
  // adicionados depois pela tela da OS).
  let eventoAtivo = false
  if (equipamentoTipo === 'gerador') {
    const snap = await getDoc(doc(db, 'geradores', equip.id))
    eventoAtivo = snap.data()?.status === 'em_evento'
  }
  let osNumero = ''
  await runTransaction(db, async (tx) => {
    const contRef = doc(db, 'contadores', 'ordens_servico')
    const contSnap = await tx.get(contRef)
    const proximo = (contSnap.exists() ? (contSnap.data().ultimo || 0) : 0) + 1
    osNumero = formatarNumeroOS(proximo)
    tx.set(contRef, { ultimo: proximo }, { merge: true })
    tx.set(doc(collection(db, 'ordens_servico')), {
      numero: osNumero,
      equipamentoId: equip.id,
      equipamentoTipo,
      equipamentoLabel: label,
      tipo,
      localTipo: foraComCliente ? 'locacao' : 'patio',
      clienteNome: foraComCliente ? (equip.eventoNome || 'Cliente') : null,
      localObra: null,
      descricao,
      horimetroAbertura: null,
      observacoes: 'Aberta pelo Agente IA a pedido do usuário.',
      mecanicoUid: null,
      mecanicoNome: mecanico,
      status: 'pendente',
      prioridade: eventoAtivo ? 'maxima' : 'normal',
      eventoAtivo,
      filtrosUsados: [],
      almoxarifeUid: uid,
      almoxarifeNome: nomeUsuario,
      dataAbertura: serverTimestamp(),
      criadoEm: serverTimestamp(),
    })
    // Gerador no pátio entra em manutenção; com cliente, fica onde está.
    if (equipamentoTipo === 'gerador' && !foraComCliente) {
      tx.update(doc(db, 'geradores', equip.id), {
        status: 'manutencao',
        localizacao: 'Em manutenção',
      })
    }
  })
  return `OS ${osNumero} aberta para ${label} (${tipo}, pendente).`
}
