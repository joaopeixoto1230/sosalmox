import { normalizar } from '../estoque/sugestaoGrupo'

// Cadastro dos "itens avulsos" do Uso Interno no estoque (grupo Material Interno).
//
// Item avulso é o que saiu digitado na mão, sem existir no estoque. A aba
// "Itens Avulsos" junta por nome e mostra quantas vezes saiu — o que sai
// sempre merece cadastro. Estas funções só SUGEREM: categoria, código e o que
// já parece cadastrado. Quem confirma é o usuário.

// Palavra encontrada no nome -> categoria do grupo Material Interno.
// A ordem importa: a primeira que casar vence.
const PISTAS = [
  [['fita', 'silver tape', 'hellerman'], 'Fitas'],
  [['parafuso', 'porca', 'arruela', 'bucha', 'abracadeira', 'rebite'], 'Fixação'],
  [['luva', 'capacete', 'oculos', 'botina', 'bota', 'protetor auricular', 'mascara', 'cinto'], 'EPI'],
  [['furadeira', 'parafusadeira', 'esmerilhadeira', 'serra eletrica', 'soprador', 'lixadeira'], 'Ferramentas Elétricas'],
  [['chave', 'alicate', 'martelo', 'serra', 'trena', 'talhadeira', 'marreta'], 'Ferramentas'],
  [['conector', 'terminal', 'estanho', 'solda', 'lubrificante', 'graxa', 'oleo', 'spray', 'cola'], 'Consumíveis'],
]

/** Categoria provável a partir do nome digitado. Sem pista, cai em Consumíveis. */
export function categoriaSugerida(nome) {
  const n = normalizar(nome)
  for (const [palavras, categoria] of PISTAS) {
    if (palavras.some(p => n.includes(p))) return categoria
  }
  return 'Consumíveis'
}

/**
 * Código curto a partir do nome, sem repetir nenhum já usado.
 * Ex.: "Fita isolante preta" -> FIP. Colidindo, vira FIP2, FIP3...
 * `usados` é um Set de códigos em MAIÚSCULA (os do estoque + os já sugeridos
 * nesta mesma tela, senão dois itens novos sairiam com o mesmo código).
 */
export function codigoSugerido(nome, usados = new Set()) {
  const palavras = normalizar(nome).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  let base = palavras.map(p => p[0]).join('').slice(0, 4).toUpperCase()
  if (base.length < 2) base = (normalizar(nome).replace(/[^a-z0-9]/g, '').slice(0, 3) || 'ITEM').toUpperCase()

  if (!usados.has(base)) return base
  for (let i = 2; i < 999; i++) {
    const tentativa = `${base}${i}`
    if (!usados.has(tentativa)) return tentativa
  }
  return base
}

/** O nome já existe no estoque? Evita cadastrar a mesma fita duas vezes. */
export function jaCadastrado(nome, materiais) {
  const n = normalizar(nome)
  if (!n) return false
  return materiais.some(m => normalizar(m.nome) === n)
}
