import { describe, it, expect } from 'vitest'
import { temPermissao, getMenuItems, PERFIS, MODULOS } from './permissions'

describe('temPermissao', () => {
  it('admin tem acesso a todos os módulos', () => {
    Object.values(MODULOS).forEach(modulo => {
      expect(temPermissao(PERFIS.ADMIN, modulo)).toBe(true)
    })
  })

  it('franca não tem acesso ao dashboard principal', () => {
    expect(temPermissao(PERFIS.FRANCA, MODULOS.DASHBOARD)).toBe(false)
  })

  it('franca tem acesso a manutenção', () => {
    expect(temPermissao(PERFIS.FRANCA, MODULOS.MANUTENCAO)).toBe(true)
  })

  it('compras não tem acesso a saída de material', () => {
    expect(temPermissao(PERFIS.COMPRAS, MODULOS.SAIDA)).toBe(false)
  })

  it('almoxarife tem acesso a saída, devolução e transferência', () => {
    expect(temPermissao(PERFIS.ALMOXARIFE, MODULOS.SAIDA)).toBe(true)
    expect(temPermissao(PERFIS.ALMOXARIFE, MODULOS.DEVOLUCAO)).toBe(true)
    expect(temPermissao(PERFIS.ALMOXARIFE, MODULOS.TRANSFERENCIA)).toBe(true)
  })

  it('retorna false para perfil inválido', () => {
    expect(temPermissao(null, MODULOS.DASHBOARD)).toBe(false)
    expect(temPermissao(undefined, MODULOS.DASHBOARD)).toBe(false)
  })
})

describe('getMenuItems', () => {
  it('admin recebe todos os itens de menu', () => {
    const itens = getMenuItems(PERFIS.ADMIN)
    expect(itens.length).toBeGreaterThan(8)
  })

  it('compras recebe apenas itens do seu perfil', () => {
    const itens = getMenuItems(PERFIS.COMPRAS)
    const paths = itens.map(i => i.path)
    expect(paths).toContain('/compras')
    expect(paths).not.toContain('/saida')
    expect(paths).not.toContain('/estoque')
  })
})
