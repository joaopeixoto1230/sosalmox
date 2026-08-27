import { describe, it, expect } from 'vitest'
import { calcularEspecies, chaveEspecie, materialEmEstoqueBaixo, contarEstoqueBaixo } from './estoqueEspecie'

// Cria n cabos iguais (cada doc = uma unidade fisica, como no cadastro real).
function cabos(categoria, bitola, status, n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${categoria}-${bitola}-${status}-${i}`,
    categoria,
    bitola,
    status,
    estoqueAtual: status === 'disponivel' ? 1 : 0,
    estoqueMin: 1,
  }))
}

describe('estoque por especie', () => {
  it('agrupa por bitola ignorando a unidade escrita e o comprimento', () => {
    const [a] = cabos('Cabos 4x', '35mm²', 'disponivel', 1)
    const [b] = cabos('Cabos 4x', '35', 'disponivel', 1)
    const c = { ...a, metragem: '80m' }
    expect(chaveEspecie(b)).toBe(chaveEspecie(a))
    expect(chaveEspecie(c)).toBe(chaveEspecie(a))
  })

  it('separa bitolas e categorias diferentes', () => {
    const [a] = cabos('Cabos 4x', '50mm²', 'disponivel', 1)
    const [b] = cabos('Cabos 4x', '35mm²', 'disponivel', 1)
    const [c] = cabos('Cabos 5x', '50mm²', 'disponivel', 1)
    expect(chaveEspecie(a)).not.toBe(chaveEspecie(b))
    expect(chaveEspecie(a)).not.toBe(chaveEspecie(c))
  })

  it('não alerta quando todas as unidades estão no pátio', () => {
    const especies = calcularEspecies(cabos('Cabos 4x', '35mm²', 'disponivel', 10))
    expect([...especies.values()][0]).toMatchObject({ total: 10, disponiveis: 10, baixo: false })
  })

  it('não alerta bitola de unidade única parada no pátio', () => {
    const especies = calcularEspecies(cabos('Cabos Terra', '120mm', 'disponivel', 1))
    expect([...especies.values()][0].baixo).toBe(false)
  })

  it('alerta quando sobrou 1 de 10 (9 em evento)', () => {
    // Categoria fora dos cabos: cabo não entra mais no alerta (regra do João).
    const materiais = [
      ...cabos('Outros Materiais', 'CX5', 'em_evento', 9),
      ...cabos('Outros Materiais', 'CX5', 'disponivel', 1),
    ]
    const especies = calcularEspecies(materiais)
    expect([...especies.values()][0]).toMatchObject({ total: 10, disponiveis: 1, baixo: true })
  })

  it('alerta quando não sobrou nenhuma unidade disponível', () => {
    const especies = calcularEspecies(cabos('Outros Materiais', 'QTA150', 'em_evento', 1))
    expect([...especies.values()][0].baixo).toBe(true)
  })

  it('alerta pelos 20% mesmo em acervo grande', () => {
    const materiais = [
      ...cabos('Outros Materiais', 'PC5', 'disponivel', 15),
      ...cabos('Outros Materiais', 'PC5', 'em_evento', 85),
    ]
    expect([...calcularEspecies(materiais).values()][0].baixo).toBe(true)
  })

  it('não alerta com folga acima de 20%', () => {
    const materiais = [
      ...cabos('Cabos 5x', '16mm', 'disponivel', 3),
      ...cabos('Cabos 5x', '16mm', 'em_evento', 7),
    ]
    expect([...calcularEspecies(materiais).values()][0].baixo).toBe(false)
  })

  it('ignora perdidos e consumidos no acervo', () => {
    const materiais = [
      ...cabos('Cabos 4x', '70mm', 'disponivel', 2),
      ...cabos('Cabos 4x', '70mm', 'perdido', 8),
    ]
    expect([...calcularEspecies(materiais).values()][0]).toMatchObject({ total: 2, disponiveis: 2, baixo: false })
  })
})

describe('cabo fora do alerta (regra do João, 27/08/2026)', () => {
  // "Cada cabo é como se fosse uma unidade": 1 de 4 disponíveis com o resto
  // em evento é operação normal, não falta. O alerta enchia a tela de cabo
  // trabalhando — 21 itens marcados, quase todos em evento.
  it('rabicho com 1 de 4 disponíveis NÃO alerta', () => {
    const materiais = [
      ...cabos('Rabichos', '4x50', 'em_evento', 3),
      ...cabos('Rabichos', '4x50', 'disponivel', 1),
    ]
    const especies = calcularEspecies(materiais)
    expect([...especies.values()][0].baixo).toBe(false)
    expect(materiais.every(m => !materialEmEstoqueBaixo(m, especies))).toBe(true)
  })

  it('nem zerado o cabo alerta — categoria de cabo fica sempre de fora', () => {
    for (const categoria of ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos']) {
      const especies = calcularEspecies(cabos(categoria, '50', 'em_evento', 4))
      expect([...especies.values()][0].baixo, categoria).toBe(false)
    }
  })

  it('vale também para categoria de cabo criada pelo usuário', () => {
    for (const categoria of ['Cabo 5x6', 'Cabo de Comunicação', 'Cables (General)']) {
      const especies = calcularEspecies(cabos(categoria, '6', 'em_evento', 2))
      expect([...especies.values()][0].baixo, categoria).toBe(false)
    }
  })

  it('caixa de passagem com o MESMO formato continua alertando', () => {
    const especies = calcularEspecies(cabos('Outros Materiais', 'CX5', 'em_evento', 4))
    expect([...especies.values()][0].baixo).toBe(true)
  })

  it('protetor de cabo não é pego pela palavra "cabo" no nome', () => {
    // A regra olha a CATEGORIA. O protetor é Outros Materiais e por
    // quantidade: segue a regra clássica dele.
    const protetor = { id: 'pr1', nome: 'Protetor de cabo 5 vias', tipo: 'Protetor de cabo', categoria: 'Outros Materiais', estoqueAtual: 0, estoqueMin: 1, status: 'disponivel' }
    expect(materialEmEstoqueBaixo(protetor, calcularEspecies([protetor]))).toBe(true)
  })
})

describe('materialEmEstoqueBaixo', () => {
  const parafuso = { id: 'p1', categoria: 'Fixação', tipo: 'Parafuso', estoqueAtual: 200, estoqueMin: 100, status: 'disponivel' }
  const fita = { id: 'p2', categoria: 'Fitas', tipo: 'Fita Isolante', estoqueAtual: 4, estoqueMin: 10, status: 'disponivel' }

  it('mantém a regra de quantidade para consumíveis', () => {
    const especies = calcularEspecies([parafuso, fita])
    expect(materialEmEstoqueBaixo(parafuso, especies)).toBe(false)
    expect(materialEmEstoqueBaixo(fita, especies)).toBe(true)
  })

  it('não marca como baixo um item perdido', () => {
    const materiais = cabos('Cabos 4x', '25mm', 'perdido', 1)
    expect(materialEmEstoqueBaixo(materiais[0], calcularEspecies(materiais))).toBe(false)
  })

  it('não marca cabo parado no pátio (o bug do 1/1)', () => {
    const materiais = cabos('Cabos 4x', '35mm²', 'disponivel', 4)
    const especies = calcularEspecies(materiais)
    expect(materiais.every(m => !materialEmEstoqueBaixo(m, especies))).toBe(true)
  })

  it('trata doc antigo sem estoqueAtual/estoqueMin como unidade', () => {
    const materiais = [
      { id: 'v1', categoria: 'Cabos 4x', bitola: '95mm²', status: 'disponivel' },
      { id: 'v2', categoria: 'Cabos 4x', bitola: '95mm²', status: 'disponivel' },
    ]
    const especies = calcularEspecies(materiais)
    expect([...especies.values()][0]).toMatchObject({ total: 2, disponiveis: 2, baixo: false })
  })
})

describe('contarEstoqueBaixo', () => {
  it('conta bitolas em falta somadas aos consumíveis abaixo do mínimo', () => {
    const materiais = [
      // caixa zerada alerta; os cabos, mesmo em falta, ficam de fora
      ...cabos('Outros Materiais', 'CX5', 'em_evento', 4),
      ...cabos('Cabos 4x', '50mm²', 'em_evento', 9),
      ...cabos('Cabos 4x', '50mm²', 'disponivel', 1),
      ...cabos('Cabos Terra', '95mm²', 'em_evento', 1),
      { id: 'p2', categoria: 'Fitas', tipo: 'Fita Isolante', estoqueAtual: 4, estoqueMin: 10, status: 'disponivel' },
    ]
    expect(contarEstoqueBaixo(materiais, calcularEspecies(materiais))).toBe(2)
  })
})
