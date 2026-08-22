import { describe, it, expect } from 'vitest'
import { categoriaSugerida, codigoSugerido, jaCadastrado } from './sugestaoCadastro'

describe('categoriaSugerida', () => {
  it('acerta o que a equipe mais tira do almoxarifado', () => {
    expect(categoriaSugerida('Fita isolante preta')).toBe('Fitas')
    expect(categoriaSugerida('Silver tape')).toBe('Fitas')
    expect(categoriaSugerida('Parafuso sextavado 8mm')).toBe('Fixação')
    expect(categoriaSugerida('Luva de vaqueta')).toBe('EPI')
    expect(categoriaSugerida('Óculos de proteção')).toBe('EPI')
    expect(categoriaSugerida('Furadeira Bosch')).toBe('Ferramentas Elétricas')
    expect(categoriaSugerida('Chave de fenda')).toBe('Ferramentas')
    expect(categoriaSugerida('Estanho 1mm')).toBe('Consumíveis')
  })

  it('ferramenta elétrica ganha da ferramenta comum quando as duas casam', () => {
    // "serra elétrica" contém "serra"; a pista mais específica vem antes.
    expect(categoriaSugerida('Serra elétrica')).toBe('Ferramentas Elétricas')
  })

  it('sem pista nenhuma, cai em Consumíveis em vez de ficar sem categoria', () => {
    expect(categoriaSugerida('xpto 42')).toBe('Consumíveis')
    expect(categoriaSugerida('')).toBe('Consumíveis')
  })
})

describe('codigoSugerido', () => {
  it('monta pelas iniciais do nome', () => {
    expect(codigoSugerido('Fita isolante preta')).toBe('FIP')
    expect(codigoSugerido('Parafuso sextavado')).toBe('PS')
  })

  it('nunca repete código já existente', () => {
    // Dois itens novos na mesma tela nao podem sair com o mesmo codigo.
    const usados = new Set(['FIP'])
    expect(codigoSugerido('Fita isolante preta', usados)).toBe('FIP2')
    usados.add('FIP2')
    expect(codigoSugerido('Fita isolante preta', usados)).toBe('FIP3')
  })

  it('aguenta nome de uma palavra curta e nome estranho', () => {
    expect(codigoSugerido('Fita')).toBe('FIT')
    expect(codigoSugerido('7')).toBe('7')
    expect(codigoSugerido('')).toBe('ITEM')
  })

  it('ignora acento e pontuação', () => {
    expect(codigoSugerido('Óculos de proteção')).toBe('ODP')
  })
})

describe('jaCadastrado', () => {
  const materiais = [{ nome: 'Fita isolante (Preta)' }, { nome: 'Cabo 35mm' }]

  it('reconhece o mesmo nome, ignorando caixa e acento', () => {
    expect(jaCadastrado('fita isolante (preta)', materiais)).toBe(true)
    expect(jaCadastrado('FITA ISOLANTE (PRETA)', materiais)).toBe(true)
  })

  it('não confunde nome parecido com nome igual', () => {
    expect(jaCadastrado('Fita isolante', materiais)).toBe(false)
    expect(jaCadastrado('', materiais)).toBe(false)
  })
})
