import { describe, it, expect } from 'vitest'
import { previsaoRuptura, consumoAnormal } from './ruptura'

const agora = new Date(2026, 7, 27) // 27/08/2026
const diasAtras = n => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000)

const filtros = [
  { id: 'f1', nome: 'Filtro de Óleo 110', referencia: 'WO-950', quantidadeAtual: 6, estoqueMin: 2 },
  // mesma referência = mesmo estoque compartilhado do f1
  { id: 'f1b', nome: 'Filtro de Óleo 150', referencia: 'WO-950', quantidadeAtual: 6, estoqueMin: 2 },
  { id: 'f2', nome: 'Filtro de Ar', referencia: 'AR-123', quantidadeAtual: 40, estoqueMin: 2 },
  { id: 'f3', nome: 'Filtro Separador', referencia: 'SEP-9', quantidadeAtual: 5, estoqueMin: 1 },
]

const baixa = (filtroId, quantidade, dias) => ({ filtroId, quantidade, criadoEm: diasAtras(dias) })

describe('previsaoRuptura', () => {
  it('projeta o fim do estoque pelo ritmo dos últimos 60 dias', () => {
    // WO-950: 12 unidades em 60 dias = 0,2/dia; 6 em estoque ≈ 30 dias
    const baixas = [baixa('f1', 6, 50), baixa('f1', 4, 20), baixa('f1b', 2, 5)]
    const r = previsaoRuptura(filtros, baixas, agora)
    expect(r).toHaveLength(1)
    expect(r[0].filtro.referencia).toBe('WO-950')
    expect(r[0].consumo60d).toBe(12) // as duas potências somam: estoque compartilhado
    expect(r[0].diasRestantes).toBe(30)
  })

  it('estoque folgado para o ritmo não alerta', () => {
    // AR-123: 4 em 60 dias com 40 em estoque = ~600 dias
    expect(previsaoRuptura(filtros, [baixa('f2', 4, 30)], agora)).toHaveLength(0)
  })

  it('uma baixa avulsa não vira ritmo', () => {
    expect(previsaoRuptura(filtros, [baixa('f3', 1, 10)], agora)).toHaveLength(0)
  })

  it('consumo fora da janela de 60 dias não conta', () => {
    expect(previsaoRuptura(filtros, [baixa('f1', 10, 90)], agora)).toHaveLength(0)
  })

  it('estoque zerado com consumo recente é o mais urgente (0 dias)', () => {
    const zerado = [{ id: 'z', nome: 'Filtro X', referencia: 'ZZ-1', quantidadeAtual: 0 }]
    const r = previsaoRuptura(zerado, [baixa('z', 3, 10)], agora)
    expect(r[0].diasRestantes).toBe(0)
  })
})

describe('consumoAnormal', () => {
  it('semana com o dobro da média histórica alerta', () => {
    // 4 semanas anteriores: 2/semana; última semana: 6
    const baixas = [
      baixa('f2', 2, 10), baixa('f2', 2, 17), baixa('f2', 2, 24), baixa('f2', 2, 31),
      baixa('f2', 6, 2),
    ]
    const r = consumoAnormal(filtros, baixas, agora)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ ultimaSemana: 6, mediaSemanal: 2 })
  })

  it('consumo alto mas dentro do padrão não alerta', () => {
    const baixas = [
      baixa('f2', 5, 10), baixa('f2', 5, 17), baixa('f2', 5, 24), baixa('f2', 5, 31),
      baixa('f2', 6, 2),
    ]
    expect(consumoAnormal(filtros, baixas, agora)).toHaveLength(0)
  })

  it('o que nunca saía e começou a sair alerta', () => {
    expect(consumoAnormal(filtros, [baixa('f3', 4, 3)], agora)).toHaveLength(1)
  })

  it('pouca coisa (< 4 na semana) não alerta, mesmo sem histórico', () => {
    expect(consumoAnormal(filtros, [baixa('f3', 3, 3)], agora)).toHaveLength(0)
  })

  it('baixa de filtro que não existe mais não derruba a conta', () => {
    expect(consumoAnormal(filtros, [baixa('sumiu', 10, 2)], agora)).toHaveLength(0)
  })
})
