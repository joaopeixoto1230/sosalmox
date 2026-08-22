import { describe, it, expect } from 'vitest'
import { pareceUsoInterno, normalizar } from './sugestaoGrupo'

describe('pareceUsoInterno', () => {
  it('pega o caso real: fita isolante cadastrada em Outros Materiais', () => {
    // Foi assim que a Fita Isolante (Preta) acabou no grupo de eventos: o tipo
    // existe nas duas categorias, e "Outros Materiais" é do grupo de eventos.
    expect(pareceUsoInterno({
      nome: 'Fita isolante (Preta)', categoria: 'Outros Materiais', tipo: 'Fita Isolante',
    })).toBe(true)
  })

  it('marca pela categoria de uso interno', () => {
    for (const categoria of ['Ferramentas', 'Fitas', 'Fixação', 'EPI', 'Consumíveis']) {
      expect(pareceUsoInterno({ categoria }), categoria).toBe(true)
    }
  })

  it('marca pelo tipo, mesmo em categoria de evento', () => {
    expect(pareceUsoInterno({ categoria: 'Outros Materiais', tipo: 'Parafuso' })).toBe(true)
    expect(pareceUsoInterno({ categoria: 'Outros Materiais', tipo: 'Luva' })).toBe(true)
  })

  it('NÃO marca material de evento de verdade', () => {
    // O maior risco da pré-marcação é levar cabo junto: são centenas de docs.
    expect(pareceUsoInterno({ categoria: 'Cabos 4x', tipo: 'Cabo único' })).toBe(false)
    expect(pareceUsoInterno({ categoria: 'Outros Materiais', tipo: 'QTA' })).toBe(false)
    expect(pareceUsoInterno({ categoria: 'Outros Materiais', tipo: 'Caixa Blindada' })).toBe(false)
    expect(pareceUsoInterno({ categoria: 'Jogos de Cabo', tipo: 'Jogo 3F+N' })).toBe(false)
  })

  it('não marca o que já está no Material Interno — não há o que mover', () => {
    expect(pareceUsoInterno({ grupo: 'uso_interno', categoria: 'Fitas', tipo: 'Fita Isolante' }))
      .toBe(false)
  })

  it('aguenta material sem categoria e sem tipo', () => {
    expect(pareceUsoInterno({})).toBe(false)
    expect(pareceUsoInterno({ categoria: null, tipo: undefined })).toBe(false)
    expect(pareceUsoInterno(null)).toBe(false)
  })

  it('ignora acento e caixa, que variam no cadastro manual', () => {
    expect(normalizar('Óculos')).toBe('oculos')
    expect(normalizar('  FIXAÇÃO ')).toBe('fixacao')
    expect(pareceUsoInterno({ categoria: 'fixacao' })).toBe(true)
    expect(pareceUsoInterno({ categoria: 'Outros Materiais', tipo: 'ÓCULOS' })).toBe(true)
  })
})
