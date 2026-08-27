import { normalizar } from '../estoque/sugestaoGrupo'

// Busca da tela de Devolução: por evento E por material.
//
// O caso real: o João sabe que o "Cabo 4x50/47/28m" está na rua, mas não
// lembra em qual evento. Digitando o nome (ou o código) do material, aparecem
// os eventos que têm aquele item em campo — com o nome do item junto, para
// ele ver POR QUE o evento apareceu na lista.

/** Map eventoId -> itens (nome/codigo) das ordens ativas daquele evento. */
export function itensPorEvento(ordens) {
  const mapa = new Map()
  for (const ordem of ordens || []) {
    if (ordem?.status !== 'ativo' || !ordem.eventoId) continue
    const lista = mapa.get(ordem.eventoId) || []
    for (const item of (ordem.itens || [])) {
      if (item?.nome || item?.codigo) lista.push(item)
    }
    mapa.set(ordem.eventoId, lista)
  }
  return mapa
}

/**
 * Filtra os eventos pela busca, casando com o nome/local do evento OU com o
 * nome/código de algum material em campo nele.
 * @returns {{evento: object, itensBatidos: object[]}[]} — `itensBatidos` só
 *   vem preenchido quando foi o material que casou (para mostrar na tela).
 */
export function filtrarEventosDevolucao(eventos, mapaItens, busca) {
  const q = normalizar(busca)
  if (!q) return (eventos || []).map(evento => ({ evento, itensBatidos: [] }))

  const resultado = []
  for (const evento of eventos || []) {
    const bateEvento = normalizar(evento.nome).includes(q)
      || normalizar(evento.local).includes(q)

    // dedup por nome: o mesmo cabo pode aparecer em mais de uma ordem
    const vistos = new Set()
    const itensBatidos = (mapaItens?.get(evento.id) || []).filter(it => {
      const bate = normalizar(it.nome).includes(q) || normalizar(it.codigo).includes(q)
      if (!bate) return false
      const chave = normalizar(it.nome) || normalizar(it.codigo)
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })

    if (bateEvento || itensBatidos.length > 0) {
      // Se o evento casou por si só, não precisa justificar com itens.
      resultado.push({ evento, itensBatidos: bateEvento ? [] : itensBatidos })
    }
  }
  return resultado
}
