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

export function patchEstorno(dados, quantidade) {
  if (!materialContado(dados)) {
    return { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 }
  }
  const devolvida = Math.max(0, Number(quantidade) || 0)
  return { status: 'disponivel', eventoAtual: null, estoqueAtual: estoqueDe(dados) + devolvida }
}
