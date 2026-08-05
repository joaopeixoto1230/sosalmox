// Grupos de estoque: "eventos" (materiais que saem para eventos — cabos, QTAs etc.)
// e "uso_interno" (ferramental, fitas, parafusos, EPI, consumíveis).
// Docs antigos NÃO têm o campo `grupo`: contam como "eventos" (sem migração).
export const GRUPOS = [
  { value: 'eventos', label: 'Materiais de Evento' },
  { value: 'uso_interno', label: 'Uso Interno' },
]

export function grupoDoMaterial(material) {
  return material?.grupo === 'uso_interno' ? 'uso_interno' : 'eventos'
}

export const CATEGORIAS_POR_GRUPO = {
  eventos: ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais'],
  uso_interno: ['Ferramentas', 'Ferramentas Elétricas', 'Fitas', 'Fixação', 'EPI', 'Consumíveis'],
}

export const TIPOS_POR_CATEGORIA = {
  'Cabos 4x': ['Cabo único', 'Cabo com terra'],
  'Cabos 5x': ['Cabo único', 'Cabo com terra'],
  'Cabos Terra': ['Cabo terra simples', 'Cabo terra CAMLOCK'],
  'Cabos (Geral)': ['Cabo específico', 'Outro'],
  'Jogos de Cabo': ['Jogo 3F+N', 'Jogo 3F'],
  'Rabichos': ['Rabicho 3F+N', 'Rabicho 3F'],
  'Outros Materiais': [
    'Caixa de Passagem',
    'Caixa de Desconexão',
    'Caixa Blindada',
    'Chave Reversora',
    'QTA',
    'Passa-cabos',
    'Protetor de cabo',
    'Fita Isolante',
    'Fita de Alta Tensão',
    'Fita de Baixa Tensão',
    'Extintor',
    'Conector',
    'Equipamento',
    'Acessório',
    'Outro',
  ],
  'Ferramentas': ['Chave', 'Alicate', 'Martelo', 'Serra', 'Trena', 'Ferramenta manual', 'Outro'],
  'Ferramentas Elétricas': ['Furadeira', 'Parafusadeira', 'Esmerilhadeira', 'Serra elétrica', 'Soprador', 'Outro'],
  'Fitas': ['Fita Isolante', 'Fita de Alta Tensão', 'Fita de Baixa Tensão', 'Silver tape', 'Abraçadeira (fita hellerman)', 'Outro'],
  'Fixação': ['Parafuso', 'Porca', 'Arruela', 'Bucha', 'Abraçadeira', 'Outro'],
  'EPI': ['Luva', 'Capacete', 'Óculos', 'Botina', 'Protetor auricular', 'Outro'],
  'Consumíveis': ['Conector', 'Terminal', 'Estanho/solda', 'Lubrificante', 'Outro'],
}

// Categorias para os selects de um grupo: as pré-definidas do grupo + as extras
// criadas pelo usuário (derivadas dos materiais já cadastrados NESSE grupo).
export function categoriasDoGrupo(grupo, materiais) {
  const padroes = CATEGORIAS_POR_GRUPO[grupo] || []
  const todasPadroes = [...CATEGORIAS_POR_GRUPO.eventos, ...CATEGORIAS_POR_GRUPO.uso_interno]
  const extras = [...new Set(
    materiais.filter(m => grupoDoMaterial(m) === grupo).map(m => m.categoria).filter(Boolean)
  )]
    .filter(c => !todasPadroes.includes(c))
    .sort((a, b) => a.localeCompare(b))
  return [...padroes, ...extras]
}
