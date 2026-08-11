import { describe, it, expect } from 'vitest'
import { GRUPOS_FROTA, grupoPorChave, linkDoGrupo } from './gruposFrota'
import { CORES } from '../dashboard/cores'

// O clique na rosca do painel só funciona se o link que ELA monta for o mesmo
// que a tela de Geradores sabe ler. Este é o teste que pega o `emUso` escrito
// no lugar de `emuso`: a tela abriria a frota inteira, calada.
describe('link da rosca -> filtro da tela (ida e volta)', () => {
  it('todo grupo volta a ser ele mesmo depois de virar link', () => {
    for (const g of GRUPOS_FROTA) {
      const params = new URL(linkDoGrupo(g.chave), 'https://sos-almox.web.app').searchParams
      expect(grupoPorChave(params.get('grupo'))).toBe(g)
    }
  })

  it('o link aponta para a rota que existe no App', () => {
    expect(linkDoGrupo('emuso')).toBe('/geradores?grupo=emuso')
  })

  it('cada grupo aponta para uma cor que existe na paleta', () => {
    for (const g of GRUPOS_FROTA) {
      expect(CORES[g.corRosca], `grupo ${g.chave}`).toBeTruthy()
    }
  })
})

describe('grupoPorChave', () => {
  it('abre o recorte que veio da rosca da frota', () => {
    expect(grupoPorChave('emuso').label).toBe('Em uso com cliente')
    expect(grupoPorChave('prontos').estados).toEqual(['disponivel'])
  })

  it('devolve null para chave ausente ou desconhecida — a tela mostra a frota toda', () => {
    expect(grupoPorChave(null)).toBeNull()
    expect(grupoPorChave('')).toBeNull()
    expect(grupoPorChave('inventado')).toBeNull()
  })
})

describe('GRUPOS_FROTA', () => {
  it('cobre todos os status de gerador ativo, sem repetir nenhum', () => {
    // Um status fora dos grupos sumiria das roscas E do recorte da frota:
    // o gerador existiria no banco sem aparecer em lugar nenhum.
    const todos = GRUPOS_FROTA.flatMap(g => g.estados)
    expect(new Set(todos).size).toBe(todos.length)
    expect(todos.sort()).toEqual(
      ['defeito', 'disponivel', 'em_evento', 'locacao', 'manutencao', 'sublocado'],
    )
  })

  it('as três modalidades de saída contam como em uso com o cliente', () => {
    // Evento, locação mensal e sublocação: o gerador está fora, não importa a
    // modalidade. Se uma delas escapar, a frota mostra disponível o que não está.
    expect(grupoPorChave('emuso').estados).toEqual(
      expect.arrayContaining(['em_evento', 'locacao', 'sublocado']),
    )
  })
})
