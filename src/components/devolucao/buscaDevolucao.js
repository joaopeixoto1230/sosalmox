import { normalizar } from '../estoque/sugestaoGrupo'
import { materialPorQuantidade } from '../../utils/formatters'
import { materialContado } from '../estoque/contagem'

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

/**
 * Itens de um evento que AINDA estão em campo.
 *
 * Item de unidade que já voltou (status != em_evento) sai da lista — foi
 * lançado individualmente ou voltou por outro caminho; mantê-lo faria a
 * confirmação final registrá-lo de novo. Contado (alambrado) e por-quantidade
 * (protetor) não deixam esse rastro no status, então ficam até o fim.
 * Material que sumiu do banco também fica: a transaction acusa o erro na hora
 * certa, com mensagem — melhor que sumir da lista em silêncio.
 */
export function itensPendentesDevolucao(itens, materiaisMap) {
  return (itens || []).filter(item => {
    const mat = materiaisMap?.get(item.id)
    if (!mat) return true
    if (materialPorQuantidade(mat) || materialContado(mat)) return true
    return mat.status === 'em_evento'
  })
}

/** O item pode ser lançado sozinho? Só material de unidade tem esse rastro. */
export function itemLancavelSozinho(item, materiaisMap) {
  const mat = materiaisMap?.get(item?.id)
  return !!mat && !materialPorQuantidade(mat) && !materialContado(mat)
}

/**
 * TUDO que está no evento — não só o que está nas ordens de saída.
 *
 * ⚠️ Material entra no evento por DOIS caminhos: a Saída de Material (grava na
 * ordem) e o "Editar material" do evento (muda só o doc do material). Montar a
 * devolução apenas pelas ordens deixava o segundo grupo INVISÍVEL: nunca era
 * devolvido, e como a devolução conclui o evento, o material ficava preso em
 * `em_evento` para sempre, some do estoque e ninguém achava. Foi o que
 * aconteceu em produção (09/09/2026).
 *
 * Junta os itens das ordens com os materiais que apontam para este evento
 * (`eventoAtual`), sem repetir.
 */
export function itensNoEvento(ordens, materiais, eventoId) {
  const mapa = new Map()
  for (const ordem of ordens || []) {
    for (const item of (ordem?.itens || [])) {
      if (item?.id && !mapa.has(item.id)) mapa.set(item.id, item)
    }
  }
  // Material preso ao evento que não está em ordem nenhuma: entrou pelo
  // "Editar material". Vira item da devolução com os dados do próprio material.
  for (const m of materiais || []) {
    if (!m?.id || mapa.has(m.id)) continue
    if (m.eventoAtual !== eventoId || m.status !== 'em_evento') continue
    mapa.set(m.id, { id: m.id, nome: m.nome || null, codigo: m.codigo || null, categoria: m.categoria || null })
  }
  return [...mapa.values()]
}

/**
 * Material PRESO: está `em_evento` mas não há evento ativo que o justifique —
 * o evento foi concluído, excluído, ou o campo ficou vazio. Some das telas de
 * devolução e nunca volta ao estoque sozinho.
 * @returns {{material, motivo}[]}
 */
export function materiaisPresos(materiais, eventos) {
  // Sem a lista de eventos não dá para julgar nada: os eventos podem só não ter
  // carregado ainda, e acusar aqui marcaria a frota inteira como presa.
  if (!eventos?.length) return []
  const porId = new Map(eventos.map(e => [e.id, e]))
  const presos = []
  for (const m of materiais || []) {
    if (m?.status !== 'em_evento') continue
    if (!m.eventoAtual) {
      presos.push({ material: m, motivo: 'sem evento vinculado' })
      continue
    }
    const evento = porId.get(m.eventoAtual)
    if (!evento) {
      presos.push({ material: m, motivo: 'o evento foi excluído' })
    } else if (evento.status === 'concluido') {
      presos.push({ material: m, motivo: `evento concluído: ${evento.nome || 'sem nome'}` })
    }
  }
  return presos
}
