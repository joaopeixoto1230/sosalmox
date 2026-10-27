// Filtros que a tela de Manutenção aceita pela URL — hoje só o tipo, vindo do
// clique na rosca "Preventiva × Corretiva" do painel.
//
// Módulo à parte (e não dentro do Manutencao.jsx) por dois motivos: exportar
// função de arquivo de componente quebra o fast refresh do Vite, e assim a
// regra fica coberta por teste.
export const TIPO_OPCOES = ['Todos', 'Preventiva', 'Corretiva']

/**
 * Traduz `?tipo=preventiva` para o rótulo do botão correspondente.
 * Valor ausente, vazio ou desconhecido cai em 'Todos': link velho ou digitado
 * errado não pode deixar a tela vazia sem explicação nenhuma.
 * @param {URLSearchParams} params
 */
export function tipoDaURL(params) {
  const bruto = (params?.get('tipo') || '').trim().toLowerCase()
  return TIPO_OPCOES.find(t => t.toLowerCase() === bruto) || 'Todos'
}

// Link que a rosca "Preventiva × Corretiva" usa. Mora junto de quem lê o
// parâmetro para os dois lados não poderem divergir em silêncio.
export function linkDoTipo(rotulo) {
  return `/manutencao?tipo=${encodeURIComponent(rotulo.toLowerCase())}`
}
