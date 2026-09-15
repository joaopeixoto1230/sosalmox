import { describe, it, expect } from 'vitest'
import { itensDoTermo, geradoresDoTermo, pendenciasDoTermo, resumoConferencia, chaveItem } from './termos'

const materiais = {
  m1: { nome: 'Cabo 4x50 (nome novo)', codigo: 'C50', categoria: 'Cabos 4x' },
}

describe('itensDoTermo', () => {
  it('junta as ordens numa lista só e soma o mesmo material', () => {
    // O cliente assina UMA lista, não uma por ordem de saída.
    const ordens = [
      { itens: [{ id: 'm1', nome: 'Cabo 4x50', codigo: 'C50' }, { id: 'm2', nome: 'Caixa', codigo: 'CX' }] },
      { itens: [{ id: 'm1', nome: 'Cabo 4x50', codigo: 'C50' }] },
    ]
    const itens = itensDoTermo(ordens, materiais)
    expect(itens).toHaveLength(2)
    expect(itens.find(i => i.id === 'm1').quantidade).toBe(2)
  })

  it('usa a quantidade do item quando ela existe (alambrado, fita)', () => {
    const ordens = [{ itens: [{ id: 'm3', nome: 'Alambrado', quantidade: 12 }] }]
    expect(itensDoTermo(ordens).find(i => i.id === 'm3').quantidade).toBe(12)
  })

  it('mostra o nome ATUAL do cadastro, não o retrato da ordem', () => {
    // A ordem guarda o nome da época; se o estoque foi corrigido depois, o
    // termo que vai ao cliente tem que sair com o nome certo.
    const ordens = [{ itens: [{ id: 'm1', nome: 'Cabo 4x50', codigo: 'C50' }] }]
    expect(itensDoTermo(ordens, materiais)[0].nome).toBe('Cabo 4x50 (nome novo)')
  })

  it('material apagado do estoque continua no termo, com o dado da ordem', () => {
    const ordens = [{ itens: [{ id: 'sumiu', nome: 'Cabo antigo', codigo: 'CA' }] }]
    expect(itensDoTermo(ordens, materiais)[0].nome).toBe('Cabo antigo')
  })

  it('item sem id ganha chave por nome+código, senão viraria um item só', () => {
    const ordens = [{ itens: [{ nome: 'Extensão', codigo: 'E1' }, { nome: 'Extensão', codigo: 'E2' }] }]
    const itens = itensDoTermo(ordens)
    expect(itens).toHaveLength(2)
    expect(new Set(itens.map(i => i.chave)).size).toBe(2)
  })

  it('aguenta ordem sem itens e lista vazia', () => {
    expect(itensDoTermo([{ }, { itens: [] }])).toEqual([])
    expect(itensDoTermo()).toEqual([])
  })
})

describe('geradoresDoTermo', () => {
  it('não repete o mesmo gerador que aparece em duas ordens', () => {
    const ordens = [
      { geradores: [{ id: 'g1', codigo: 'GG-015' }] },
      { geradores: [{ id: 'g1', codigo: 'GG-015' }, { id: 'g2', codigo: 'GG-020' }] },
    ]
    expect(geradoresDoTermo(ordens).map(g => g.codigo)).toEqual(['GG-015', 'GG-020'])
  })

  it('lê a ordem antiga, que só tinha geradorCodigo', () => {
    expect(geradoresDoTermo([{ geradorCodigo: 'GG-007' }])).toEqual([{ id: null, codigo: 'GG-007' }])
  })
})

describe('pendenciasDoTermo', () => {
  const itens = [{ chave: 'a' }, { chave: 'b' }]

  it('entrega pede nome, CPF e assinatura do cliente', () => {
    const faltando = pendenciasDoTermo('entrega', {})
    expect(faltando).toHaveLength(3)
    expect(faltando.join(' ')).toContain('CPF')
  })

  it('entrega completa não tem pendência', () => {
    expect(pendenciasDoTermo('entrega', {
      clienteNome: 'Maria Souza', clienteDocumento: '123.456.789-00', clienteAssinatura: 'data:image/png;base64,x',
    })).toEqual([])
  })

  it('devolução pede RG, as DUAS assinaturas e a conferência de todo item', () => {
    // Item sem resposta sairia no documento como devolvido — justamente o
    // buraco que o termo veio tapar (o cabo que sumiu no shopping).
    const faltando = pendenciasDoTermo('devolucao', {
      itens, clienteNome: 'João', clienteDocumento: '1234567', clienteAssinatura: 'x',
      conferencia: { a: 'ok' },
    })
    expect(faltando.join(' ')).toContain('recolhendo')
    expect(faltando.join(' ')).toContain('conferência de 1 item')
  })

  it('devolução completa não tem pendência', () => {
    expect(pendenciasDoTermo('devolucao', {
      itens, clienteNome: 'João', clienteDocumento: '1234567',
      clienteAssinatura: 'x', sosAssinatura: 'y',
      conferencia: { a: 'ok', b: 'faltou' },
    })).toEqual([])
  })

  it('nome só com espaços não vale', () => {
    expect(pendenciasDoTermo('entrega', {
      clienteNome: '   ', clienteDocumento: '1', clienteAssinatura: 'x',
    })).toEqual(['o nome do cliente'])
  })
})

describe('resumoConferencia', () => {
  it('separa o que voltou do que faltou', () => {
    const itens = [{ chave: 'a', nome: 'Cabo' }, { chave: 'b', nome: 'Caixa' }]
    const r = resumoConferencia(itens, { a: 'ok', b: 'faltou' })
    expect(r.devolvidos.map(i => i.nome)).toEqual(['Cabo'])
    expect(r.faltantes.map(i => i.nome)).toEqual(['Caixa'])
    expect(r.tudoOk).toBe(false)
  })

  it('sem faltante nenhum, tudoOk', () => {
    expect(resumoConferencia([{ chave: 'a' }], { a: 'ok' }).tudoOk).toBe(true)
  })
})

describe('chaveItem', () => {
  it('prefere o id do material', () => {
    expect(chaveItem({ id: 'm1', nome: 'Cabo' })).toBe('m1')
  })
})
