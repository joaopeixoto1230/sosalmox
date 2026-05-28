import { describe, it, expect } from 'vitest'
import { formatarNumeroOrdem, statusEventoCor, statusMaterialLabel } from './formatters'

describe('formatarNumeroOrdem', () => {
  it('formata número com zero-padding', () => {
    const ano = new Date().getFullYear()
    expect(formatarNumeroOrdem(1)).toBe(`OM-${ano}-001`)
    expect(formatarNumeroOrdem(42)).toBe(`OM-${ano}-042`)
    expect(formatarNumeroOrdem(100)).toBe(`OM-${ano}-100`)
  })
})

describe('statusEventoCor', () => {
  it('retorna classe correta para cada status', () => {
    expect(statusEventoCor('ativo')).toContain('green')
    expect(statusEventoCor('agendado')).toContain('blue')
    expect(statusEventoCor('encerrado')).toContain('gray')
    expect(statusEventoCor('cancelado')).toContain('red')
    expect(statusEventoCor('desconhecido')).toContain('gray')
  })
})

describe('statusMaterialLabel', () => {
  it('retorna label correto', () => {
    expect(statusMaterialLabel('disponivel')).toBe('Disponível')
    expect(statusMaterialLabel('em_evento')).toBe('Em Evento')
    expect(statusMaterialLabel('manutencao')).toBe('Manutenção')
    expect(statusMaterialLabel('perdido')).toBe('Perdido')
  })
})
