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
export function patchEstorno(dados, quantidade) {
  if (!materialContado(dados)) {
    return { status: 'disponivel', eventoAtual: null, estoqueAtual: 1 }
  }
  const devolvida = Math.max(0, Number(quantidade) || 0)
  return { status: 'disponivel', eventoAtual: null, estoqueAtual: estoqueDe(dados) + devolvida }
}
