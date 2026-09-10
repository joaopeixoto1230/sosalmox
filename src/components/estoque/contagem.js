import { materialPorQuantidade } from '../../utils/formatters'
import { materialPorUnidade } from './estoqueEspecie'
import { grupoDoMaterial } from './categorias'
import { normalizar } from './sugestaoGrupo'

// Material CONTADO: existem 20 na prateleira, saem 3, sobram 17.
//
// O resto do sistema trata 1 documento = 1 unidade (cada cabo é um doc), e a
// saída marca o doc inteiro como consumido. Isso serve para cabo e ferramenta,
// mas não para fita e parafuso, que saem em quantidade do mesmo doc.
//
// Vale SÓ dentro do grupo Material Interno, de propósito: material de evento
// continua exatamente como sempre foi.

export const CATEGORIAS_CONTADAS = ['Fitas', 'Fixação', 'EPI', 'Consumíveis']

export function materialContado(material) {
  if (!material) return false
  // "Protetor de cabo" tem regra própria e nunca mexe em estoque. Não mudar.
  if (materialPorQuantidade(material)) return false

  // Marcado à mão na edição do material. Vale em QUALQUER grupo, porque existe
  // material de evento que também sai por quantidade — o alambrado de proteção
  // é o caso: saem 10 de 50 e sobram 40, igual à fita.
  if (material.porQuantidade === true) return true

  if (grupoDoMaterial(material) !== 'uso_interno') return false

  const categoria = normalizar(material.categoria)
  if (CATEGORIAS_CONTADAS.some(c => normalizar(c) === categoria)) return true
  // Fora dessas categorias, conta quem tem mais de uma unidade na prateleira
  // (ferramenta é uma só, então segue como unidade).
  return !materialPorUnidade(material)
}

export function estoqueDe(material) {
  return Math.max(0, Number(material?.estoqueAtual) || 0)
}

/** Quanto dá para tirar de fato: nunca mais do que existe. */
export function baixaPossivel(material, pedido) {
  return Math.min(Math.max(1, Number(pedido) || 1), estoqueDe(material))
}

/**
 * O que gravar no material ao dar saída.
 * `dados` é o doc como está no banco (lido na transaction).
 * Item contado desconta a quantidade e só troca de status ao zerar — senão a
 * fita sumiria da lista de disponíveis tendo ainda 17 rolos na prateleira.
 */
export function patchSaida(dados, quantidade, subtipo) {
  const statusFora = subtipo === 'emprestimo' ? 'emprestado' : 'consumido'
  if (!materialContado(dados)) {
    return { status: statusFora, eventoAtual: null, estoqueAtual: 0 }
  }
  const resta = Math.max(0, estoqueDe(dados) - Math.max(0, Number(quantidade) || 0))
  return resta === 0
    ? { status: statusFora, eventoAtual: null, estoqueAtual: 0 }
    : { estoqueAtual: resta }
}

/**
 * O que gravar ao desfazer uma saída (devolução ok, ou lançamento excluído).
 * Item contado devolve a quantidade ao que já existe; item de unidade volta a
 * ser 1, como sempre foi.
 */
/**
 * Saída para EVENTO. O material de unidade vai inteiro para o evento
 * (`em_evento` + `eventoAtual`), como sempre. O contado só perde quantidade e
 * NÃO muda de status: 10 alambrados saírem não pode tirar os outros 40 da
 * prateleira nem prendê-los a esse evento.
 */
export function patchSaidaEvento(dados, quantidade, eventoId) {
  if (!materialContado(dados)) {
    return { status: 'em_evento', eventoAtual: eventoId, estoqueAtual: 0 }
  }
  return { estoqueAtual: Math.max(0, estoqueDe(dados) - Math.max(0, Number(quantidade) || 0)) }
}

/**
 * Devolução de EVENTO. Devolve `null` quando não há nada a escrever.
 *
 * ⚠️ Para o contado, a decisão NÃO pode olhar o status (ele continua
 * `disponivel` enquanto sobra estoque) — a devolução de evento pula item que
 * não está `em_evento`, e o contado cairia nesse buraco em silêncio.
 * Danificado e perdido não voltam para o estoque: a linha inteira da devolução
 * se refere àquelas unidades.
 */
export function patchDevolucaoEvento(dados, quantidade, statusDevolucao) {
  // Material que JÁ está `em_evento` saiu pela regra antiga (doc inteiro), mesmo
  // que tenha sido marcado como contado depois. Tratar como contado aqui o
  // deixaria preso em `em_evento` para sempre.
  const saiuComoUnidade = dados?.status === 'em_evento'

  if (materialContado(dados) && !saiuComoUnidade) {
    if (statusDevolucao !== 'ok' && statusDevolucao !== 'cortado') return null
    return { estoqueAtual: estoqueDe(dados) + Math.max(0, Number(quantidade) || 0) }
  }
  if (statusDevolucao === 'ok' || statusDevolucao === 'cortado') {
    return { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 }
  }
  if (statusDevolucao === 'perdido') return { status: 'perdido', eventoAtual: null }
  if (statusDevolucao === 'problema') return { status: 'manutencao', eventoAtual: null }
  return null
}

/**
 * Materiais CONTADOS que estão num evento, com a quantidade somada.
 *
 * O contado não fica `em_evento` nem ganha `eventoAtual` — o vínculo dele com o
 * evento são os itens das ordens de saída. Toda tela que devolve material ao
 * fim do evento (concluir, excluir, editar material) precisa passar por aqui,
 * senão a quantidade fica fora da prateleira para sempre, sem aviso.
 *
 * @returns {{material: object, quantidade: number}[]}
 */
export function contadosDoEvento(ordens, materiais) {
  const porId = new Map()
  for (const ordem of ordens || []) {
    for (const item of (ordem?.itens || [])) {
      if (!item?.id) continue
      const material = materiais.find(m => m.id === item.id)
      if (!material || !materialContado(material)) continue
      const atual = porId.get(item.id) || { material, quantidade: 0 }
      atual.quantidade += Number(item.quantidade) || 1
      porId.set(item.id, atual)
    }
  }
  return [...porId.values()]
}

export function patchEstorno(dados, quantidade) {
  if (!materialContado(dados)) {
    return { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 }
  }
  const devolvida = Math.max(0, Number(quantidade) || 0)
  return { status: 'disponivel', eventoAtual: null, estoqueAtual: estoqueDe(dados) + devolvida }
}

/**
 * Patch de troca MANUAL de status, feita pelo menu do card.
 *
 * ⚠️ Trocar só o `status` deixa o cadastro travado: a saída zera o
 * `estoqueAtual` e prende o `eventoAtual`, então o card volta a dizer
 * "Disponível" enquanto a Saída recusa o material (ela exige estoque > 0).
 * Foi o que aconteceu em produção com o Cabo terra 95/72/11m.
 *
 * O contado (fita, alambrado) administra a própria quantidade: forçar 1 aqui
 * transformaria 17 rolos de fita em 1. Por isso ele só troca de status.
 */
export function patchStatusManual(material, novoStatus) {
  if (materialContado(material)) return { status: novoStatus }
  if (novoStatus !== 'disponivel') return { status: novoStatus, estoqueAtual: 0 }
  return { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 }
}

/**
 * Quanto gravar em `estoqueAtual` ao SALVAR a edição de um material.
 *
 * O formulário abre com `material.estoqueAtual ?? 0`, então material antigo sem
 * o campo era salvo com zero — e ficava "disponível" sem poder sair, do nada,
 * só por alguém ter corrigido o nome. Unidade disponível tem no mínimo 1.
 */
export function estoqueAoEditar(material, novoStatus, valorDigitado) {
  const n = Number(valorDigitado)
  const valor = Number.isFinite(n) ? n : 0
  if (materialContado(material)) return valor
  if (novoStatus !== 'disponivel') return valor
  return valor > 0 ? valor : 1
}
