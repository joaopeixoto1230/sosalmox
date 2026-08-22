import { CATEGORIAS_POR_GRUPO, grupoDoMaterial } from './categorias'

// Sugestão de quais materiais são, na prática, de uso interno.
//
// Existe porque o grupo "Material Interno" nasceu depois do estoque: fita
// isolante, parafuso e EPI foram cadastrados dentro de "Outros Materiais",
// que é categoria do grupo de eventos. A tela de mover em lote usa isto só
// para PRÉ-MARCAR — quem decide é o usuário, item por item.

// Tipos que denunciam uso interno mesmo estando numa categoria de evento.
// Ficam em minúsculas e sem acento na comparação (ver `normalizar`).
export const TIPOS_USO_INTERNO = [
  'fita isolante',
  'fita de alta tensao',
  'fita de baixa tensao',
  'silver tape',
  'abracadeira (fita hellerman)',
  'abracadeira',
  'parafuso',
  'porca',
  'arruela',
  'bucha',
  'luva',
  'capacete',
  'oculos',
  'botina',
  'protetor auricular',
  'estanho/solda',
  'lubrificante',
  'chave',
  'alicate',
  'martelo',
  'serra',
  'trena',
  'ferramenta manual',
  'furadeira',
  'parafusadeira',
  'esmerilhadeira',
  'serra eletrica',
  'soprador',
]

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * O material parece ser de uso interno? Serve só para pré-marcar a caixinha.
 * Material que JÁ está no grupo uso_interno devolve false: não há o que mover.
 */
export function pareceUsoInterno(material) {
  if (grupoDoMaterial(material) === 'uso_interno') return false

  const categoria = normalizar(material?.categoria)
  const daCategoriaInterna = CATEGORIAS_POR_GRUPO.uso_interno
    .some(c => normalizar(c) === categoria)
  if (daCategoriaInterna) return true

  const tipo = normalizar(material?.tipo)
  return tipo ? TIPOS_USO_INTERNO.includes(tipo) : false
}
