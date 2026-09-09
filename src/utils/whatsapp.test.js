import { describe, it, expect } from 'vitest'
import { telefoneParaWhatsApp, linkWhatsApp } from './whatsapp'

describe('telefoneParaWhatsApp', () => {
  it('aceita o telefone como a máscara da sublocação grava', () => {
    expect(telefoneParaWhatsApp('(61) 99999-8888')).toBe('5561999998888')
    expect(telefoneParaWhatsApp('(61) 3333-4444')).toBe('556133334444')
  })

  it('não duplica o DDI quando já veio com 55', () => {
    expect(telefoneParaWhatsApp('+55 61 99999-8888')).toBe('5561999998888')
    expect(telefoneParaWhatsApp('5561999998888')).toBe('5561999998888')
  })

  it('número curto ou estranho devolve null — abrir o seletor é melhor que errar o contato', () => {
    expect(telefoneParaWhatsApp('99999-8888')).toBeNull() // sem DDD
    expect(telefoneParaWhatsApp('123')).toBeNull()
    expect(telefoneParaWhatsApp('')).toBeNull()
    expect(telefoneParaWhatsApp(null)).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('com telefone, abre a conversa já na pessoa', () => {
    expect(linkWhatsApp('(61) 99999-8888', 'oi')).toBe('https://wa.me/5561999998888?text=oi')
  })

  it('sem telefone, cai no link genérico (escolher contato)', () => {
    expect(linkWhatsApp('', 'oi')).toBe('https://wa.me/?text=oi')
    expect(linkWhatsApp(undefined, 'oi')).toBe('https://wa.me/?text=oi')
  })

  it('escapa a mensagem, que leva link e acento', () => {
    const url = linkWhatsApp('61999998888', 'Assine: https://sos-almox.web.app/assinar/abc — obrigado')
    expect(url).toContain('https%3A%2F%2Fsos-almox.web.app%2Fassinar%2Fabc')
    expect(url).not.toContain(' ')
  })
})
