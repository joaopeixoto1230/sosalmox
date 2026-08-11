import { describe, it, expect } from 'vitest'
import { tipoDaURL, TIPO_OPCOES, linkDoTipo } from './filtrosURL'

// Mesma trava do lado da frota: o link que a rosca monta tem que ser lido de
// volta como o mesmo tipo, senão o clique abre a lista inteira sem avisar.
describe('link da rosca -> filtro da tela (ida e volta)', () => {
  it('cada tipo volta a ser ele mesmo depois de virar link', () => {
    for (const t of ['Preventiva', 'Corretiva']) {
      const params = new URL(linkDoTipo(t), 'https://sos-almox.web.app').searchParams
      expect(tipoDaURL(params)).toBe(t)
    }
  })

  it('o link aponta para a rota que existe no App', () => {
    expect(linkDoTipo('Preventiva')).toBe('/manutencao?tipo=preventiva')
  })
})

const params = qs => new URLSearchParams(qs)

describe('tipoDaURL', () => {
  it('abre no tipo que veio da rosca do painel', () => {
    expect(tipoDaURL(params('tipo=preventiva'))).toBe('Preventiva')
    expect(tipoDaURL(params('tipo=corretiva'))).toBe('Corretiva')
  })

  it('sem parâmetro nenhum, mostra tudo', () => {
    expect(tipoDaURL(params(''))).toBe('Todos')
    expect(tipoDaURL(params('status=pendente'))).toBe('Todos')
  })

  it('não quebra com URL estranha — cai em Todos, nunca em tela vazia', () => {
    expect(tipoDaURL(params('tipo='))).toBe('Todos')
    expect(tipoDaURL(params('tipo=inventado'))).toBe('Todos')
    expect(tipoDaURL(undefined)).toBe('Todos')
  })

  it('aceita maiúscula e espaço, que é o que sobra de link copiado', () => {
    expect(tipoDaURL(params('tipo=PREVENTIVA'))).toBe('Preventiva')
    expect(tipoDaURL(params('tipo=%20corretiva%20'))).toBe('Corretiva')
  })

  it('devolve sempre um rótulo que existe no botão da tela', () => {
    for (const qs of ['tipo=preventiva', 'tipo=corretiva', '', 'tipo=xpto']) {
      expect(TIPO_OPCOES).toContain(tipoDaURL(params(qs)))
    }
  })
})
