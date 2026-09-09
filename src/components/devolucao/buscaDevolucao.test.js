import { describe, it, expect } from 'vitest'
import { itensPorEvento, filtrarEventosDevolucao, itensPendentesDevolucao, itemLancavelSozinho, itensNoEvento, materiaisPresos } from './buscaDevolucao'

const eventos = [
  { id: 'e1', nome: 'HOT WHEELS MONSTER TRUCK LIVE', local: 'Eixo Monumental' },
  { id: 'e2', nome: 'SESC Ceilândia', local: 'QNN 27' },
]

const ordens = [
  { eventoId: 'e1', status: 'ativo', itens: [{ nome: 'Cabo 4x50/47/28m', codigo: '28' }, { nome: 'Caixa Blindada', codigo: 'CBL' }] },
  { eventoId: 'e1', status: 'ativo', itens: [{ nome: 'Cabo 4x50/47/28m', codigo: '28' }] },
  { eventoId: 'e2', status: 'ativo', itens: [{ nome: 'Refletor de Led 600W', codigo: '600W' }] },
  // ordem devolvida nao conta: aquele material ja voltou
  { eventoId: 'e2', status: 'devolvida', itens: [{ nome: 'Cabo 5x6/146/29m', codigo: '56146' }] },
]

const mapa = itensPorEvento(ordens)

describe('busca da devolução por evento + material', () => {
  it('sem busca, lista todos os eventos sem justificar nada', () => {
    const r = filtrarEventosDevolucao(eventos, mapa, '')
    expect(r.map(x => x.evento.id)).toEqual(['e1', 'e2'])
    expect(r.every(x => x.itensBatidos.length === 0)).toBe(true)
  })

  it('acha o evento pelo nome do material em campo — o caso do João', () => {
    const r = filtrarEventosDevolucao(eventos, mapa, 'cabo 4x50')
    expect(r.map(x => x.evento.id)).toEqual(['e1'])
    // mostra o item que casou, sem repetir o cabo que estava em duas ordens
    expect(r[0].itensBatidos.map(i => i.nome)).toEqual(['Cabo 4x50/47/28m'])
  })

  it('acha pelo código do material', () => {
    const r = filtrarEventosDevolucao(eventos, mapa, 'CBL')
    expect(r.map(x => x.evento.id)).toEqual(['e1'])
  })

  it('material de ordem já devolvida não traz o evento', () => {
    expect(filtrarEventosDevolucao(eventos, mapa, 'Cabo 5x6/146')).toEqual([])
  })

  it('busca por evento continua funcionando, com acento e caixa ignorados', () => {
    const r = filtrarEventosDevolucao(eventos, mapa, 'sesc ceilandia')
    expect(r.map(x => x.evento.id)).toEqual(['e2'])
    expect(r[0].itensBatidos).toEqual([]) // casou pelo nome, não precisa justificar
  })

  it('busca pelo local do evento também vale', () => {
    expect(filtrarEventosDevolucao(eventos, mapa, 'eixo monumental').map(x => x.evento.id))
      .toEqual(['e1'])
  })

  it('aguenta ordem sem itens e item sem nome', () => {
    const m = itensPorEvento([{ eventoId: 'e1', status: 'ativo' }, { eventoId: 'e1', status: 'ativo', itens: [{}] }])
    expect(filtrarEventosDevolucao(eventos, m, 'cabo')).toEqual([])
  })
})

describe('devolução item a item', () => {
  const mapa = new Map([
    ['cabo1', { id: 'cabo1', categoria: 'Cabos 4x', status: 'em_evento', estoqueAtual: 0, estoqueMin: 1 }],
    ['cabo2', { id: 'cabo2', categoria: 'Cabos 4x', status: 'disponivel', estoqueAtual: 1, estoqueMin: 1 }],
    ['alamb', { id: 'alamb', nome: 'Alambrado', categoria: 'Outros Materiais', porQuantidade: true, estoqueAtual: 40 }],
    ['prot', { id: 'prot', nome: 'Protetor de cabo 5 vias', tipo: 'Protetor de cabo', categoria: 'Outros Materiais', estoqueAtual: 10 }],
  ])
  const itens = [{ id: 'cabo1' }, { id: 'cabo2' }, { id: 'alamb', quantidade: 10 }, { id: 'prot', quantidade: 2 }, { id: 'sumiu' }]

  it('item de unidade que já voltou sai da lista — o caso do lançamento individual', () => {
    // cabo2 já está disponivel: foi lançado sozinho. Mantê-lo na lista faria a
    // confirmação final registrá-lo de novo.
    const pendentes = itensPendentesDevolucao(itens, mapa)
    expect(pendentes.map(i => i.id)).toEqual(['cabo1', 'alamb', 'prot', 'sumiu'])
  })

  it('contado e por-quantidade ficam até o fim: não deixam rastro no status', () => {
    const pendentes = itensPendentesDevolucao([{ id: 'alamb' }, { id: 'prot' }], mapa)
    expect(pendentes).toHaveLength(2)
  })

  it('material apagado do banco continua na lista — a transaction dá o erro com mensagem', () => {
    expect(itensPendentesDevolucao([{ id: 'sumiu' }], mapa)).toHaveLength(1)
  })

  it('só material de unidade pode ser lançado sozinho', () => {
    expect(itemLancavelSozinho({ id: 'cabo1' }, mapa)).toBe(true)
    // contado devolve por quantidade e nao tem status para travar o duplo
    // credito; por-quantidade nem mexe em estoque; sumido nao da para validar
    expect(itemLancavelSozinho({ id: 'alamb' }, mapa)).toBe(false)
    expect(itemLancavelSozinho({ id: 'prot' }, mapa)).toBe(false)
    expect(itemLancavelSozinho({ id: 'sumiu' }, mapa)).toBe(false)
  })

  it('aguenta lista e mapa vazios', () => {
    expect(itensPendentesDevolucao(null, mapa)).toEqual([])
    expect(itensPendentesDevolucao(itens, undefined).map(i => i.id)).toEqual(itens.map(i => i.id))
  })
})

// O bug de produção (09/09/2026): material adicionado pelo "Editar material" do
// evento não entra na ordem de saída, então a devolução — que montava a lista
// só pelas ordens — nunca o via. Ficava em_evento para sempre.
describe('itensNoEvento', () => {
  const materiais = [
    { id: 'cabo1', nome: 'Cabo 4x50', status: 'em_evento', eventoAtual: 'e1' },
    { id: 'cx1', nome: 'Caixa de passagem', status: 'em_evento', eventoAtual: 'e1' },
    { id: 'cabo2', nome: 'Cabo 5x6', status: 'em_evento', eventoAtual: 'e2' },
    { id: 'cabo3', nome: 'Cabo terra', status: 'disponivel', eventoAtual: null },
  ]
  const ordens = [{ itens: [{ id: 'cabo1', nome: 'Cabo 4x50', codigo: 'C45' }] }]

  it('pega o material que entrou pelo "Editar material", fora de qualquer ordem', () => {
    const r = itensNoEvento(ordens, materiais, 'e1')
    expect(r.map(i => i.id).sort()).toEqual(['cabo1', 'cx1'])
  })

  it('não repete o item que está na ordem E aponta para o evento', () => {
    expect(itensNoEvento(ordens, materiais, 'e1').filter(i => i.id === 'cabo1')).toHaveLength(1)
  })

  it('não traz material de outro evento nem o que já voltou', () => {
    const ids = itensNoEvento(ordens, materiais, 'e1').map(i => i.id)
    expect(ids).not.toContain('cabo2')
    expect(ids).not.toContain('cabo3')
  })

  it('preserva o item da ordem como está — ele carrega quantidade e código', () => {
    expect(itensNoEvento(ordens, materiais, 'e1').find(i => i.id === 'cabo1').codigo).toBe('C45')
  })

  it('aguenta lista vazia dos dois lados', () => {
    expect(itensNoEvento(null, null, 'e1')).toEqual([])
    expect(itensNoEvento([], materiais, 'inexistente')).toEqual([])
  })
})

describe('materiaisPresos', () => {
  const eventos = [
    { id: 'ativo', nome: 'CCUG', status: 'ativo' },
    { id: 'fechado', nome: 'SESC', status: 'concluido' },
  ]
  const materiais = [
    { id: 'a', nome: 'No evento ativo', status: 'em_evento', eventoAtual: 'ativo' },
    { id: 'b', nome: 'Evento concluído', status: 'em_evento', eventoAtual: 'fechado' },
    { id: 'c', nome: 'Evento apagado', status: 'em_evento', eventoAtual: 'sumiu' },
    { id: 'd', nome: 'Sem vínculo', status: 'em_evento', eventoAtual: null },
    { id: 'e', nome: 'Normal', status: 'disponivel', eventoAtual: null },
  ]

  it('acha só o que está preso — material em evento ATIVO não é problema', () => {
    const r = materiaisPresos(materiais, eventos)
    expect(r.map(x => x.material.id).sort()).toEqual(['b', 'c', 'd'])
  })

  it('explica o motivo de cada um, para o usuário entender antes de liberar', () => {
    const porId = Object.fromEntries(materiaisPresos(materiais, eventos).map(x => [x.material.id, x.motivo]))
    expect(porId.b).toContain('concluído')
    expect(porId.c).toContain('excluído')
    expect(porId.d).toContain('sem evento')
  })

  it('sem eventos carregados, não acusa nada de errado por engano', () => {
    // Os materiais carregam antes dos eventos. Julgar com a lista vazia
    // marcaria TODO material em evento como "evento excluído" — falso alarme
    // que levaria alguém a liberar material que está na rua.
    expect(materiaisPresos(materiais, [])).toEqual([])
    expect(materiaisPresos(materiais, null)).toEqual([])
  })
})
