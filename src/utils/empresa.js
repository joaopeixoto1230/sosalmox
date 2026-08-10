// Dados da SOS usados nos documentos impressos (declaração de entrega etc.).
// ⚠️ PREENCHER com os dados reais antes de usar a Declaração de Sublocação em
// papel: um documento com CNPJ errado não serve de nada. Enquanto estiver em
// branco, o botão avisa em vez de gerar.
export const EMPRESA = {
  razaoSocial: '',
  cnpj: '',
  endereco: '',
  cidade: 'Brasília/DF',
}

export function empresaConfigurada() {
  return Boolean(EMPRESA.razaoSocial.trim() && EMPRESA.cnpj.trim())
}
