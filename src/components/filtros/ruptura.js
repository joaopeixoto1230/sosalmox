// ===== Avisos proativos de filtros =====
//
// Duas leituras do histórico de baixas (baixas_filtro), ambas determinísticas
// e testadas — a IA do briefing escreve EM CIMA destes números, nunca os
// inventa:
//
// 1. previsaoRuptura: no ritmo de consumo dos últimos 60 dias, em quantos dias
//    o estoque atual acaba ("previsão de ruptura").
// 2. consumoAnormal: a última semana saiu do padrão das 4 semanas anteriores.
//
// O agrupamento é por REFERÊNCIA (estoque compartilhado): a baixa gravada num
// doc vale para todos os filtros iguais, então consumo e estoque são do grupo.

const DIA_MS = 24 * 60 * 60 * 1000
export const JANELA_RUPTURA_DIAS = 60
export const LIMIAR_RUPTURA_DIAS = 30
export const RUPTURA_CRITICA_DIAS = 10

const paraData = v => (v?.toDate ? v.toDate() : (v ? new Date(v) : null))
const chaveDe = f => (f.referencia || '').trim().toLowerCase() || `id:${f.id}`

// Um representante por referência (mesma referência = mesmo estoque).
function gruposPorReferencia(filtros) {
  const mapa = new Map()
  for (const f of filtros) {
    if (!mapa.has(chaveDe(f))) mapa.set(chaveDe(f), f)
  }
  return mapa
}

function consumoPorGrupo(filtros, baixas, deMs, ateMs) {
  const chavePorId = new Map(filtros.map(f => [f.id, chaveDe(f)]))
  const total = new Map()
  for (const b of baixas) {
    const quando = paraData(b.criadoEm)?.getTime()
    if (!quando || quando < deMs || quando >= ateMs) continue
    const chave = chavePorId.get(b.filtroId)
    if (!chave) continue
    total.set(chave, (total.get(chave) || 0) + (Number(b.quantidade) || 0))
  }
  return total
}

/**
 * Filtros a caminho de acabar, do mais urgente para o menos.
 * Só entra quem teve consumo real na janela (>= 2 unidades — uma baixa avulsa
 * não é ritmo) e cuja projeção fica dentro do limiar.
 * @returns {{filtro, consumo60d, diasRestantes}[]}
 */
export function previsaoRuptura(filtros, baixas, agora = new Date()) {
  const fim = agora.getTime()
  const consumo = consumoPorGrupo(filtros, baixas, fim - JANELA_RUPTURA_DIAS * DIA_MS, fim + DIA_MS)

  const avisos = []
  for (const [chave, filtro] of gruposPorReferencia(filtros)) {
    const usado = consumo.get(chave) || 0
    if (usado < 2) continue
    const porDia = usado / JANELA_RUPTURA_DIAS
    const estoque = Math.max(0, Number(filtro.quantidadeAtual) || 0)
    const diasRestantes = Math.floor(estoque / porDia)
    if (diasRestantes <= LIMIAR_RUPTURA_DIAS) {
      avisos.push({ filtro, consumo60d: usado, diasRestantes })
    }
  }
  return avisos.sort((a, b) => a.diasRestantes - b.diasRestantes)
}

/**
 * Consumo fora do padrão: a última semana usou pelo menos 4 unidades E pelo
 * menos o dobro da média semanal das 4 semanas anteriores. Média zero com
 * semana cheia também alerta — o que nunca saía começou a sair.
 * @returns {{filtro, ultimaSemana, mediaSemanal}[]}
 */
export function consumoAnormal(filtros, baixas, agora = new Date()) {
  const fim = agora.getTime()
  const seteDias = 7 * DIA_MS
  const ultima = consumoPorGrupo(filtros, baixas, fim - seteDias, fim + DIA_MS)
  const anteriores = consumoPorGrupo(filtros, baixas, fim - 5 * seteDias, fim - seteDias)

  const avisos = []
  for (const [chave, filtro] of gruposPorReferencia(filtros)) {
    const semana = ultima.get(chave) || 0
    const media = (anteriores.get(chave) || 0) / 4
    if (semana >= 4 && semana >= media * 2) {
      avisos.push({ filtro, ultimaSemana: semana, mediaSemanal: media })
    }
  }
  return avisos.sort((a, b) => b.ultimaSemana - a.ultimaSemana)
}
