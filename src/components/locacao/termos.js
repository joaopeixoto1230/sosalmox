// Termos de ENTREGA e DEVOLUÇÃO do material que fica na posse do cliente.
//
// Na locação mensal (e na sublocação) o material dorme no cliente — shopping,
// obra, evento de temporada. Quando alguém vai recolher semanas depois, não há
// papel nenhum dizendo o que foi deixado lá nem quem recebeu. Em 15/09/2026
// faltou um cabo num shopping e não havia como cobrar de ninguém.
//
// O termo resolve isso com duas assinaturas de cada lado:
//   ENTREGA   — a SOS assina ao deixar, o cliente confere a lista e assina
//               (nome por extenso + CPF). Vira o comprovante que vai ao cliente.
//   DEVOLUÇÃO — o colaborador que vai recolher abre o link no local, marca item
//               a item o que voltou e o que faltou, tira foto, e colhe nome, RG
//               e assinatura de quem está devolvendo — mais a dele.
//
// Este arquivo é a parte PURA (sem Firestore), para ficar coberta por teste:
// montar a lista de itens, dizer o que falta preencher e resumir a conferência.

export const TIPOS_TERMO = {
  entrega: {
    titulo: 'Termo de Entrega',
    acao: 'Confirmar recebimento',
    docLabel: 'CPF',
    quemAssina: 'quem recebe o material',
  },
  devolucao: {
    titulo: 'Termo de Devolução',
    acao: 'Confirmar devolução',
    docLabel: 'RG',
    quemAssina: 'quem está devolvendo o material',
  },
}

/** Chave estável do item dentro do termo: o id do material, ou nome+código. */
export function chaveItem(item) {
  if (item?.id) return item.id
  return `${item?.nome || ''}|${item?.codigo || ''}`
}

/**
 * Itens do termo, a partir das ordens de saída do evento.
 *
 * Junta as ordens todas e soma o mesmo material — o cliente assina UMA lista,
 * não uma por ordem. O nome vem do cadastro ATUAL quando o material ainda
 * existe (a ordem guarda um retrato da época), com o da ordem como reserva.
 */
export function itensDoTermo(ordens = [], materiaisMap = {}) {
  const mapa = new Map()
  for (const ordem of ordens || []) {
    for (const bruto of (ordem?.itens || [])) {
      const atual = (bruto?.id && materiaisMap[bruto.id]) || null
      const item = {
        id: bruto?.id || null,
        nome: atual?.nome || bruto?.nome || null,
        codigo: atual?.codigo || bruto?.codigo || null,
        categoria: atual?.categoria || bruto?.categoria || null,
      }
      const chave = chaveItem(item)
      const qtd = Number(bruto?.quantidade) > 0 ? Number(bruto.quantidade) : 1
      const registro = mapa.get(chave) || { ...item, chave, quantidade: 0 }
      registro.quantidade += qtd
      mapa.set(chave, registro)
    }
  }
  return [...mapa.values()]
}

/**
 * Geradores do evento pelas ordens. Ordem nova traz o array `geradores`;
 * ordem antiga só tinha `geradorCodigo` — mesma reserva do resto da tela.
 */
export function geradoresDoTermo(ordens = []) {
  const mapa = new Map()
  for (const ordem of ordens || []) {
    const lista = Array.isArray(ordem?.geradores) && ordem.geradores.length > 0
      ? ordem.geradores
      : (ordem?.geradorCodigo ? [{ id: null, codigo: ordem.geradorCodigo }] : [])
    for (const g of lista) {
      if (!g?.codigo || mapa.has(g.codigo)) continue
      mapa.set(g.codigo, { id: g.id || null, codigo: g.codigo })
    }
  }
  return [...mapa.values()]
}

/**
 * O que ainda falta para o termo poder ser assinado — em linguagem de tela,
 * para o botão explicar em vez de só ficar apagado.
 *
 * ⚠️ Na devolução TODO item precisa de resposta. Sem isso, item esquecido sairia
 * no documento como devolvido, que é exatamente o buraco que o termo veio tapar.
 */
export function pendenciasDoTermo(tipo, form = {}) {
  const texto = v => String(v ?? '').trim()
  const faltando = []

  if (!texto(form.clienteNome)) faltando.push('o nome por extenso')
  if (!texto(form.clienteDocumento)) {
    faltando.push(tipo === 'devolucao' ? 'o RG de quem está devolvendo' : 'o CPF')
  }
  if (!form.clienteAssinatura) faltando.push('a assinatura do cliente')

  if (tipo === 'devolucao') {
    if (!form.sosAssinatura) faltando.push('a assinatura de quem está recolhendo')
    const semResposta = (form.itens || []).filter(i => !form.conferencia?.[i.chave])
    if (semResposta.length > 0) {
      faltando.push(`a conferência de ${semResposta.length} ${semResposta.length === 1 ? 'item' : 'itens'}`)
    }
  }

  return faltando
}

/**
 * Separa o que voltou do que faltou.
 *
 * Item sem resposta conta como devolvido só para EXIBIR um termo já assinado
 * (termo antigo, item acrescentado depois). Quem ainda está preenchendo é
 * barrado por `pendenciasDoTermo`, que exige resposta em todos.
 */
export function resumoConferencia(itens = [], conferencia = {}) {
  const devolvidos = []
  const faltantes = []
  for (const item of itens || []) {
    if (conferencia?.[item.chave] === 'faltou') faltantes.push(item)
    else devolvidos.push(item)
  }
  return { devolvidos, faltantes, tudoOk: faltantes.length === 0 }
}
