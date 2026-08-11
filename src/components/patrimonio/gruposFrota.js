// Situação da frota agrupada pela pergunta que interessa: dá para fechar
// negócio hoje? O detalhe por status continua na legenda.
//
// Fica aqui, fora do Dashboard, porque o Patrimônio usa os MESMOS grupos ao
// receber `?grupo=` na URL (o clique na rosca do painel). Duas listas separadas
// significariam painel e frota discordando sobre o que é "em uso".
// `cor`/`texto` são as classes da barra da frota; `corRosca` é a chave da
// paleta em dashboard/cores.js, que passou pela verificação de daltonismo.
export const GRUPOS_FROTA = [
  { chave: 'prontos', label: 'Prontos para sair', cor: 'bg-green-500', texto: 'text-green-600', corRosca: 'prontos', estados: ['disponivel'] },
  { chave: 'emuso', label: 'Em uso com cliente', cor: 'bg-blue-500', texto: 'text-blue-600', corRosca: 'emUso', estados: ['em_evento', 'locacao', 'sublocado'] },
  { chave: 'indisp', label: 'Indisponíveis', cor: 'bg-orange-500', texto: 'text-orange-600', corRosca: 'indisponivel', estados: ['manutencao', 'defeito'] },
]

export function grupoPorChave(chave) {
  return GRUPOS_FROTA.find(g => g.chave === chave) || null
}

// Link que a rosca da frota usa. Fica junto de quem LÊ o parâmetro para os dois
// lados não poderem divergir: com o link escrito à mão no painel, um `emUso` no
// lugar de `emuso` abriria a frota inteira sem ninguém perceber o erro.
export function linkDoGrupo(chave) {
  return `/geradores?grupo=${encodeURIComponent(chave)}`
}
