// Link de conversa do WhatsApp (wa.me).
//
// Na sublocação o telefone de quem retira é obrigatório, então dá para abrir a
// conversa JÁ na pessoa certa em vez de cair no seletor de contatos. Nos demais
// casos (evento/locação) não há telefone gravado e o link sai sem número, para
// o almoxarife escolher o contato.

const DDI_BRASIL = '55'

/**
 * Telefone brasileiro -> formato do wa.me (só dígitos, com DDI).
 * Aceita "(61) 99999-8888", "61999998888", "+55 61 99999-8888".
 * Devolve null quando não dá para confiar no número — melhor abrir o seletor
 * de contatos do que mandar mensagem para o número errado.
 */
export function telefoneParaWhatsApp(telefone) {
  const d = String(telefone ?? '').replace(/\D/g, '')
  if (!d) return null
  // Já veio com DDI: 55 + DDD (2) + 8 ou 9 dígitos
  if (d.startsWith(DDI_BRASIL) && (d.length === 12 || d.length === 13)) return d
  // DDD + número, sem DDI
  if (d.length === 10 || d.length === 11) return DDI_BRASIL + d
  return null
}

/**
 * Monta a URL do WhatsApp. Sem telefone utilizável, devolve o link genérico
 * (o WhatsApp abre pedindo para escolher o contato).
 */
export function linkWhatsApp(telefone, mensagem) {
  const numero = telefoneParaWhatsApp(telefone)
  const texto = encodeURIComponent(String(mensagem ?? ''))
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`
}
