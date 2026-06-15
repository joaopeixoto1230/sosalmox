// Normaliza a referência de um filtro para comparação:
// ignora maiúsculas/minúsculas e espaços (ex.: "LF 3675" === "lf3675").
export function normalizarRef(r) {
  return (r || '').toString().toUpperCase().replace(/\s+/g, '').trim()
}

// Retorna os IDs dos filtros IGUAIS (mesma referência) ao filtro informado,
// incluindo ele próprio. Usado para sincronizar o estoque compartilhado.
// Se o filtro não tiver referência cadastrada, retorna apenas ele mesmo
// (sem referência não há como saber quais são iguais).
export function idsFiltrosIguais(filtros, filtro) {
  const ref = normalizarRef(filtro.referencia)
  if (!ref) return [filtro.id]
  const ids = (filtros || [])
    .filter(f => f.ativo !== false && normalizarRef(f.referencia) === ref)
    .map(f => f.id)
  return ids.includes(filtro.id) ? ids : [...ids, filtro.id]
}
