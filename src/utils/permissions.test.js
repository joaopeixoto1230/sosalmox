import { describe, it, expect } from 'vitest'
import { getMenuItems, PERFIS } from './permissions'

const rotulos = itens => itens.map(i => i.label)
const acha = (itens, label) => itens.find(i => i.label === label)

describe('menu por perfil', () => {
  it('admin vê o grupo de eventos com os três filhos', () => {
    const grupo = acha(getMenuItems(PERFIS.ADMIN), 'Eventos e Locações')
    expect(rotulos(grupo.filhos)).toEqual(['Eventos', 'Locações mensais', 'Sublocações'])
  })

  it('admin vê o grupo de estoque com materiais, filtros e uso interno', () => {
    const grupo = acha(getMenuItems(PERFIS.ADMIN), 'Estoque')
    expect(rotulos(grupo.filhos)).toEqual(['Materiais', 'Filtros', 'Uso Interno'])
  })

  it('Uso Interno não sobrou solto fora do grupo', () => {
    expect(rotulos(getMenuItems(PERFIS.ADMIN))).not.toContain('Uso Interno')
  })

  // O mecânico tem FILTROS mas não ESTOQUE. Se o grupo herdasse a permissão de
  // um módulo próprio, ele perderia os Filtros do menu sem ninguém perceber.
  it('mecânico continua com Filtros, mesmo sem acesso a Estoque', () => {
    const itens = getMenuItems(PERFIS.FRANCA)
    expect(rotulos(itens)).toContain('Filtros')
    expect(rotulos(itens)).not.toContain('Materiais')
  })

  it('grupo que sobra com um filho vira item comum, sem expander', () => {
    const item = acha(getMenuItems(PERFIS.FRANCA), 'Filtros')
    expect(item.filhos).toBeUndefined()
    expect(item.path).toBe('/filtros')
    expect(item.icon).toBe('package') // mantém o ícone do grupo
  })

  it('grupo sem nenhum filho permitido some inteiro', () => {
    const itens = getMenuItems(PERFIS.COMPRAS)
    expect(rotulos(itens)).not.toContain('Eventos e Locações')
    expect(rotulos(itens)).not.toContain('Estoque')
    expect(rotulos(itens)).toEqual(['Dashboard Compras', 'Solicitações'])
  })

  it('todo item tem destino: ou é grupo com filhos, ou tem path', () => {
    for (const perfil of Object.values(PERFIS)) {
      for (const item of getMenuItems(perfil)) {
        if (item.filhos) expect(item.filhos.every(f => f.path)).toBe(true)
        else expect(item.path).toBeTruthy()
      }
    }
  })
})
