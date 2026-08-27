import { describe, it, expect } from 'vitest'
import { mascaraCNPJ, mascaraDocumento, mascaraTelefone } from './mascaras'

describe('mascaraCNPJ', () => {
  it('formata completo, inclusive o CNPJ real da SOS', () => {
    expect(mascaraCNPJ('72642655000174')).toBe('72.642.655/0001-74')
  })

  it('vai formatando enquanto digita, sem pular pontuação', () => {
    expect(mascaraCNPJ('7')).toBe('7')
    expect(mascaraCNPJ('726')).toBe('72.6')
    expect(mascaraCNPJ('726426')).toBe('72.642.6')
    expect(mascaraCNPJ('726426550')).toBe('72.642.655/0')
    expect(mascaraCNPJ('7264265500017')).toBe('72.642.655/0001-7')
  })

  it('ignora o que não é número e corta o excesso', () => {
    expect(mascaraCNPJ('72.642.655/0001-74')).toBe('72.642.655/0001-74')
    expect(mascaraCNPJ('72642655000174999')).toBe('72.642.655/0001-74')
    expect(mascaraCNPJ('abc')).toBe('')
    expect(mascaraCNPJ('')).toBe('')
  })
})

describe('mascaraDocumento (CPF ou RG no mesmo campo)', () => {
  it('11 dígitos vira CPF', () => {
    expect(mascaraDocumento('12345678901')).toBe('123.456.789-01')
    // colar um CPF já formatado não estraga
    expect(mascaraDocumento('123.456.789-01')).toBe('123.456.789-01')
  })

  it('menos dígitos vira RG, com o verificador depois do traço', () => {
    expect(mascaraDocumento('123456789')).toBe('12.345.678-9')
    expect(mascaraDocumento('12345678')).toBe('1.234.567-8')
    expect(mascaraDocumento('1234567')).toBe('123.456-7')
  })

  it('RG com X de verificador mantém o X', () => {
    expect(mascaraDocumento('12345678X')).toBe('12.345.678-X')
    expect(mascaraDocumento('12345678x')).toBe('12.345.678-X')
  })

  it('documento com letra no meio fica como digitado — formato varia por estado', () => {
    expect(mascaraDocumento('MG-12.345.678')).toBe('MG-12.345.678')
  })

  it('não trava enquanto digita pouco — traço só entra com 5+ dígitos', () => {
    expect(mascaraDocumento('1')).toBe('1')
    expect(mascaraDocumento('12')).toBe('12')
    expect(mascaraDocumento('1234')).toBe('1.234')
    expect(mascaraDocumento('12345')).toBe('1.234-5')
    expect(mascaraDocumento('')).toBe('')
  })
})

describe('mascaraTelefone', () => {
  it('celular com 9 dígitos', () => {
    expect(mascaraTelefone('61999998888')).toBe('(61) 99999-8888')
  })

  it('fixo com 8 dígitos', () => {
    expect(mascaraTelefone('6133334444')).toBe('(61) 3333-4444')
  })

  it('formata enquanto digita', () => {
    expect(mascaraTelefone('6')).toBe('(6')
    expect(mascaraTelefone('61')).toBe('(61')
    expect(mascaraTelefone('619')).toBe('(61) 9')
    expect(mascaraTelefone('61999')).toBe('(61) 999')
    expect(mascaraTelefone('619999988')).toBe('(61) 9999-988')
  })

  it('colar formatado não estraga, excesso é cortado', () => {
    expect(mascaraTelefone('(61) 99999-8888')).toBe('(61) 99999-8888')
    expect(mascaraTelefone('61999998888555')).toBe('(61) 99999-8888')
    expect(mascaraTelefone('')).toBe('')
  })
})
