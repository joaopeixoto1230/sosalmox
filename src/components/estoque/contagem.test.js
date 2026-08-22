import { describe, it, expect } from 'vitest'
import { materialContado, patchSaida, patchEstorno, baixaPossivel } from './contagem'

const fita = { grupo: 'uso_interno', categoria: 'Fitas', nome: 'Fita isolante', estoqueAtual: 20, estoqueMin: 1 }
const furadeira = { grupo: 'uso_interno', categoria: 'Ferramentas Elétricas', nome: 'Furadeira', estoqueAtual: 1, estoqueMin: 1 }
const cabo = { categoria: 'Cabos 4x', nome: 'Cabo 35mm', estoqueAtual: 1, estoqueMin: 1 }

describe('materialContado', () => {
  it('conta o consumível do Material Interno', () => {
    expect(materialContado(fita)).toBe(true)
    expect(materialContado({ grupo: 'uso_interno', categoria: 'Fixação' })).toBe(true)
    expect(materialContado({ grupo: 'uso_interno', categoria: 'EPI' })).toBe(true)
  })

  it('ferramenta continua sendo uma unidade — sai uma, volta uma', () => {
    expect(materialContado(furadeira)).toBe(false)
  })

  it('NÃO mexe em material de evento, seja qual for a categoria', () => {
    // A regra vale só dentro do Material Interno, para o fluxo de evento
    // (cabos, romaneio, devolução) continuar exatamente como sempre foi.
    expect(materialContado(cabo)).toBe(false)
    expect(materialContado({ categoria: 'Fitas', estoqueAtual: 20 })).toBe(false)
  })

  it('protetor de cabo fica de fora: tem regra propria e nao mexe em estoque', () => {
    expect(materialContado({ grupo: 'uso_interno', categoria: 'Consumíveis', tipo: 'Protetor de cabo' }))
      .toBe(false)
  })

  it('no Material Interno, quem tem mais de um na prateleira também conta', () => {
    expect(materialContado({ grupo: 'uso_interno', categoria: 'Outra coisa', estoqueAtual: 10, estoqueMin: 2 }))
      .toBe(true)
  })
})

describe('patchSaida', () => {
  it('desconta a quantidade e mantém disponível enquanto sobrar', () => {
    // O caso que motivou tudo: saem 3 de 20, sobram 17 — e a fita continua
    // aparecendo na lista de disponíveis.
    expect(patchSaida(fita, 3, 'consumo')).toEqual({ estoqueAtual: 17 })
  })

  it('ao zerar, aí sim troca de status', () => {
    expect(patchSaida({ ...fita, estoqueAtual: 3 }, 3, 'consumo'))
      .toEqual({ status: 'consumido', eventoAtual: null, estoqueAtual: 0 })
    expect(patchSaida({ ...fita, estoqueAtual: 3 }, 3, 'emprestimo'))
      .toEqual({ status: 'emprestado', eventoAtual: null, estoqueAtual: 0 })
  })

  it('nunca deixa o estoque negativo', () => {
    expect(patchSaida({ ...fita, estoqueAtual: 2 }, 5, 'consumo'))
      .toEqual({ status: 'consumido', eventoAtual: null, estoqueAtual: 0 })
  })

  it('item de unidade continua sendo baixado inteiro, como sempre', () => {
    expect(patchSaida(furadeira, 1, 'emprestimo'))
      .toEqual({ status: 'emprestado', eventoAtual: null, estoqueAtual: 0 })
    expect(patchSaida(cabo, 1, 'consumo'))
      .toEqual({ status: 'consumido', eventoAtual: null, estoqueAtual: 0 })
  })
})

describe('patchEstorno', () => {
  it('devolve a quantidade ao que já existe', () => {
    // Devolveu 3 de um empréstimo e a prateleira ja tinha 17: volta a 20.
    expect(patchEstorno({ ...fita, estoqueAtual: 17 }, 3))
      .toEqual({ status: 'disponivel', eventoAtual: null, estoqueAtual: 20 })
  })

  it('estorna certo mesmo quando o item tinha zerado', () => {
    expect(patchEstorno({ ...fita, estoqueAtual: 0, status: 'consumido' }, 3))
      .toEqual({ status: 'disponivel', eventoAtual: null, estoqueAtual: 3 })
  })

  it('item de unidade volta a ser 1, como sempre foi', () => {
    expect(patchEstorno(furadeira, 1))
      .toEqual({ status: 'disponivel', eventoAtual: null, estoqueAtual: 1 })
  })

  it('ida e volta fecha a conta', () => {
    const depoisDaSaida = { ...fita, ...patchSaida(fita, 4, 'emprestimo') }
    expect(depoisDaSaida.estoqueAtual).toBe(16)
    expect(patchEstorno(depoisDaSaida, 4).estoqueAtual).toBe(20)
  })
})

describe('ciclo completo da prateleira', () => {
  it('20 fitas: saem 3, saem mais 5, devolvem 3, apagam o lançamento de 5 -> 20', () => {
    // Reproduz a sequencia real: UsoInternoFlow grava patchSaida, a devolucao
    // e a exclusao gravam patchEstorno. Se a conta nao fechar aqui, o estoque
    // do Joao desanda em silencio.
    let doc = { ...fita } // 20

    doc = { ...doc, ...patchSaida(doc, 3, 'consumo') }
    expect(doc.estoqueAtual).toBe(17)
    expect(doc.status).toBeUndefined() // segue disponivel, nao trocou de status

    doc = { ...doc, ...patchSaida(doc, 5, 'emprestimo') }
    expect(doc.estoqueAtual).toBe(12)

    doc = { ...doc, ...patchEstorno(doc, 3) }
    expect(doc.estoqueAtual).toBe(15)

    doc = { ...doc, ...patchEstorno(doc, 5) }
    expect(doc.estoqueAtual).toBe(20)
    expect(doc.status).toBe('disponivel')
  })

  it('zerando e estornando, o item volta a aparecer como disponível', () => {
    let doc = { ...fita, estoqueAtual: 2 }
    doc = { ...doc, ...patchSaida(doc, 2, 'consumo') }
    expect(doc).toMatchObject({ estoqueAtual: 0, status: 'consumido' })
    doc = { ...doc, ...patchEstorno(doc, 2) }
    expect(doc).toMatchObject({ estoqueAtual: 2, status: 'disponivel' })
  })

  it('ferramenta: sai inteira e volta inteira, como sempre foi', () => {
    let doc = { ...furadeira }
    doc = { ...doc, ...patchSaida(doc, 1, 'emprestimo') }
    expect(doc).toMatchObject({ estoqueAtual: 0, status: 'emprestado' })
    doc = { ...doc, ...patchEstorno(doc, 1) }
    expect(doc).toMatchObject({ estoqueAtual: 1, status: 'disponivel' })
  })
})

describe('baixaPossivel', () => {
  it('não deixa tirar mais do que existe', () => {
    expect(baixaPossivel(fita, 3)).toBe(3)
    expect(baixaPossivel({ ...fita, estoqueAtual: 2 }, 5)).toBe(2)
    expect(baixaPossivel({ ...fita, estoqueAtual: 0 }, 1)).toBe(0)
  })
})
