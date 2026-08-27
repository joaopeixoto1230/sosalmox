import { materialPorQuantidade } from '../../utils/formatters'

// ===== Estoque por especie =====
// Cada cabo e cadastrado como UMA unidade fisica (doc com estoqueAtual 1 e
// estoqueMin 1). Comparar estoqueAtual com estoqueMin nesses docs marcava TODO
// cabo parado no almoxarifado como "estoque baixo" (1 <= 1), o que tornava o
// alerta inutil. O estoque real de um cabo e quantas unidades DA MESMA BITOLA
// ainda estao disponiveis: 10 cabos 4x50 com 9 em evento = so 1 disponivel.

// Status que tiram a unidade do acervo: nao contam nem como total.
const FORA_DO_ACERVO = ['perdido', 'consumido']

// Regra do Joao (27/08/2026): CABO nao entra no alerta de estoque baixo.
// Cada cabo e uma unidade; "1 de 4 disponiveis" com o resto em evento e
// operacao normal, nao falta — o alerta enchia a tela de cabo trabalhando.
// Vale pela CATEGORIA (Cabos 4x/5x/Terra/(Geral), Jogos de Cabo, Rabichos e
// as criadas pelo usuario, como "Cabo 5x6"), entao "Protetor de cabo", que e
// categoria Outros Materiais, continua com a regra dele.
export function categoriaDeCabo(categoria) {
  const c = String(categoria || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return c.includes('cabo') || c.includes('cable') || c.includes('rabicho')
}

// Material "por unidade": o doc representa um item fisico unico.
// Consumiveis (protetor de cabo, parafuso 200/100, fita) seguem a regra
// classica de quantidade — para eles estoqueAtual/estoqueMin faz sentido.
export function materialPorUnidade(material) {
  if (!material) return false
  if (materialPorQuantidade(material)) return false
  // Campo ausente (doc antigo) conta como 0: segue sendo uma unidade.
  const atual = Number(material.estoqueAtual) || 0
  const minimo = Number(material.estoqueMin) || 0
  return atual <= 1 && minimo <= 1
}

// "35mm²", "240mm" e "35" viram a mesma bitola.
export function normalizarBitola(bitola) {
  return String(bitola || '')
    .toLowerCase()
    .replace(/mm²|mm2|mm/g, '')
    .replace(/\s+/g, '')
    .trim()
}

// Especie = o que o almoxarife trata como intercambiavel: mesma categoria e
// mesma bitola. O comprimento NAO separa (4x50 de 20m e de 34m contam juntos).
// Sem bitola (QTA, caixa de passagem), agrupa pelo tipo.
export function chaveEspecie(material) {
  const bitola = normalizarBitola(material.bitola)
  return `${material.categoria || '-'}|${bitola || material.tipo || material.nome || '-'}`
}

export function rotuloEspecie(material) {
  return material.bitola || material.tipo || material.categoria || 'Sem bitola'
}

// Alerta quando nao sobrou nenhuma unidade disponivel; quando sobrou so 1
// tendo mais de uma no acervo; ou quando restam 20% ou menos do total.
// Uma bitola com uma unica unidade parada no patio NAO alerta.
export function especieEstaBaixa({ total, disponiveis }) {
  if (total <= 0) return false
  if (disponiveis === 0) return true
  if (total > 1 && disponiveis <= 1) return true
  return disponiveis <= total * 0.2
}

// Mapa chaveEspecie -> { total, disponiveis, baixo, rotulo }.
export function calcularEspecies(materiais) {
  const mapa = new Map()
  for (const m of materiais) {
    if (!materialPorUnidade(m)) continue
    if (FORA_DO_ACERVO.includes(m.status)) continue
    const chave = chaveEspecie(m)
    const especie = mapa.get(chave) || { total: 0, disponiveis: 0, rotulo: rotuloEspecie(m), ehCabo: categoriaDeCabo(m.categoria) }
    especie.total += 1
    if (m.status === 'disponivel') especie.disponiveis += 1
    mapa.set(chave, especie)
  }
  for (const especie of mapa.values()) {
    especie.baixo = !especie.ehCabo && especieEstaBaixa(especie)
  }
  return mapa
}

function quantidadeEmFalta(material) {
  return Number(material.estoqueMin) > 0 && Number(material.estoqueAtual) <= Number(material.estoqueMin)
}

export function materialEmEstoqueBaixo(material, especies) {
  if (!materialPorUnidade(material)) return quantidadeEmFalta(material)
  if (FORA_DO_ACERVO.includes(material.status)) return false
  return especies.get(chaveEspecie(material))?.baixo || false
}

// Total de alertas de reposicao: bitolas em falta + consumiveis abaixo do minimo.
export function contarEstoqueBaixo(materiais, especies) {
  const especiesBaixas = [...especies.values()].filter(e => e.baixo).length
  const consumiveisBaixos = materiais.filter(m => !materialPorUnidade(m) && quantidadeEmFalta(m)).length
  return especiesBaixas + consumiveisBaixos
}
