// Dados da SOS usados nos documentos impressos (declaração de entrega etc.).
// A razão social é o nome jurídico, diferente do nome fantasia pelo qual a
// empresa é conhecida — no documento os dois aparecem, para o cliente
// reconhecer de quem se trata.
export const EMPRESA = {
  razaoSocial: 'SOS MOVEL TRES R LTDA',
  nomeFantasia: 'SOS Energia',
  cnpj: '72.642.655/0001-74',
  // Em branco, o documento omite a expressão "com sede na ..." em vez de
  // imprimir um espaço vazio.
  endereco: 'SMSE Quadra 17, Lote 01, Samambaia/DF',
  cidade: 'Brasília/DF',
}

export function empresaConfigurada() {
  return Boolean(EMPRESA.razaoSocial.trim() && EMPRESA.cnpj.trim())
}
