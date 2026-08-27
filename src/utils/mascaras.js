// Máscaras de digitação da sublocação (CNPJ, CPF/RG, telefone).
//
// Aplicadas no onChange: a pessoa digita só números e os pontos, traços e
// parênteses entram sozinhos. O valor GRAVADO é o mascarado — é ele que sai
// na Declaração de Entrega e no relatório, então já fica no formato certo.

const soDigitos = (v, max) => String(v ?? '').replace(/\D/g, '').slice(0, max)

/** 12345678000190 -> 12.345.678/0001-90 (progressivo enquanto digita) */
export function mascaraCNPJ(valor) {
  const d = soDigitos(valor, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/**
 * Documento de quem retira: CPF ou RG no mesmo campo.
 * - 11 dígitos -> CPF: 123.456.789-01
 * - menos que isso -> RG: último dígito após o traço, resto em grupos de 3
 *   a partir da direita (12.345.678-9). RG com letra (ex: verificador X ou
 *   formato de outro estado) fica como a pessoa digitou — formato varia demais
 *   para adivinhar.
 */
export function mascaraDocumento(valor) {
  const bruto = String(valor ?? '')
  if (/[a-wyzA-WYZ]/.test(bruto)) return bruto

  const x = /[xX]$/.test(bruto.trim()) ? 'X' : ''
  const d = soDigitos(bruto, 11)
  if (!d) return x ? bruto : ''

  if (d.length === 11 && !x) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  // RG: separa o verificador e agrupa o corpo de 3 em 3 pela direita
  const digitos = d.slice(0, 10)
  // O traço só entra com 5+ dígitos: no comecinho, "1-2" ficaria estranho.
  const verificador = x || (digitos.length >= 5 ? digitos.slice(-1) : '')
  const corpo = verificador && !x ? digitos.slice(0, -1) : digitos
  const agrupado = corpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return verificador ? `${agrupado}-${verificador}` : agrupado
}

/** (61) 99999-8888 — aceita fixo (8 dígitos) e celular (9) */
export function mascaraTelefone(valor) {
  const d = soDigitos(valor, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const ddd = `(${d.slice(0, 2)}) `
  const resto = d.slice(2)
  if (resto.length <= 4) return ddd + resto
  const corte = resto.length <= 8 ? 4 : 5
  return ddd + resto.slice(0, corte) + '-' + resto.slice(corte)
}
