import { describe, it, expect } from 'vitest'
import { resolverAcao, ferramentasDoPerfil, resolverData } from './acoesAgente'

const filtros = [
  { id: 'f1', nome: 'Filtro de Óleo 1', referencia: 'WO-950', potenciaGG: '110kVA', quantidadeAtual: 8, estoqueMin: 2 },
  { id: 'f2', nome: 'Filtro de Óleo 1', referencia: 'WO-950', potenciaGG: '150kVA', quantidadeAtual: 8, estoqueMin: 2 },
  { id: 'f3', nome: 'Filtro de Óleo 1', referencia: 'PSL-55', potenciaGG: '500kVA', quantidadeAtual: 3, estoqueMin: 1 },
  { id: 'f4', nome: 'Filtro de Ar', referencia: 'AR-123', potenciaGG: '110kVA', quantidadeAtual: 5, estoqueMin: 1 },
]

const geradores = [
  { id: 'g15', codigo: 'GG-015', status: 'disponivel' },
  { id: 'g45', codigo: 'GG-045', status: 'locacao', eventoNome: 'Shopping Partage' },
]
const veiculos = [{ id: 'v1', placa: 'JHZ-8226', modelo: 'Ford 2422' }]

const ctx = { filtros, geradores, veiculos, uid: 'u1', nomeUsuario: 'João' }

describe('registrar_baixa_filtro — resolução', () => {
  it('acha o filtro por nome + potência e monta a confirmação', () => {
    const r = resolverAcao('registrar_baixa_filtro', { filtro: 'filtro de óleo', potencia: '500', quantidade: 2 }, ctx)
    expect(r.erro).toBeUndefined()
    expect(r.titulo).toBe('Registrar baixa de filtro')
    expect(r.linhas.find(([k]) => k === 'Filtro')[1]).toContain('500kVA')
    expect(r.dados.filtro.id).toBe('f3')
  })

  it('mesma referência em duas potências é UM estoque — não é ambíguo', () => {
    // WO-950 existe em 110 e 150kVA (estoque compartilhado): baixar de
    // qualquer um baixa dos dois, então não há o que perguntar.
    const r = resolverAcao('registrar_baixa_filtro', { filtro: 'WO-950', quantidade: 1 }, ctx)
    expect(r.erro).toBeUndefined()
  })

  it('ambíguo de verdade (referências diferentes) volta pergunta, não ação', () => {
    const r = resolverAcao('registrar_baixa_filtro', { filtro: 'filtro de óleo', quantidade: 1 }, ctx)
    expect(r.erro).toContain('Mais de um filtro')
  })

  it('não deixa baixar mais do que o estoque', () => {
    const r = resolverAcao('registrar_baixa_filtro', { filtro: 'AR-123', quantidade: 99 }, ctx)
    expect(r.erro).toContain('só 5 em estoque')
  })

  it('filtro inexistente e quantidade inválida viram erro explicável', () => {
    expect(resolverAcao('registrar_baixa_filtro', { filtro: 'xpto', quantidade: 1 }, ctx).erro).toContain('Nenhum filtro')
    expect(resolverAcao('registrar_baixa_filtro', { filtro: 'AR-123', quantidade: 0 }, ctx).erro).toBeTruthy()
    expect(resolverAcao('registrar_baixa_filtro', { filtro: 'AR-123', quantidade: -2 }, ctx).erro).toBeTruthy()
  })
})

describe('abrir_ordem_servico — resolução', () => {
  it('acha o gerador por variações do código (gg15, GG-15, GG-015)', () => {
    for (const eq of ['gg15', 'GG-15', 'GG-015', 'gg 15']) {
      const r = resolverAcao('abrir_ordem_servico', { equipamento: eq, tipo: 'corretiva', descricao: 'vazamento' }, ctx)
      expect(r.erro, eq).toBeUndefined()
      expect(r.linhas.find(([k]) => k === 'Equipamento')[1]).toBe('GG-015')
    }
  })

  it('acha o veículo pela placa, com ou sem hífen', () => {
    const r = resolverAcao('abrir_ordem_servico', { equipamento: 'jhz8226', tipo: 'preventiva', descricao: 'revisão' }, ctx)
    expect(r.erro).toBeUndefined()
    expect(r.linhas.find(([k]) => k === 'Equipamento')[1]).toContain('JHZ-8226')
  })

  it('gerador em locação: OS no cliente, sem trazer o GG para o pátio', () => {
    const r = resolverAcao('abrir_ordem_servico', { equipamento: 'GG-45', tipo: 'corretiva', descricao: 'fumaça' }, ctx)
    expect(r.erro).toBeUndefined()
    expect(r.linhas.find(([k]) => k === 'Local')[1]).toContain('Shopping Partage')
  })

  it('equipamento desconhecido, tipo inválido e descrição vazia viram erro', () => {
    expect(resolverAcao('abrir_ordem_servico', { equipamento: 'GG-999', tipo: 'corretiva', descricao: 'x' }, ctx).erro).toContain('não encontrado')
    expect(resolverAcao('abrir_ordem_servico', { equipamento: 'GG-15', tipo: 'urgente', descricao: 'x' }, ctx).erro).toBeTruthy()
    expect(resolverAcao('abrir_ordem_servico', { equipamento: 'GG-15', tipo: 'corretiva', descricao: '  ' }, ctx).erro).toBeTruthy()
  })
})

describe('ferramentasDoPerfil', () => {
  it('cada perfil só recebe as ferramentas dos módulos que pode usar', () => {
    const nomes = perfil => ferramentasDoPerfil(perfil).map(f => f.name)
    expect(nomes('admin')).toEqual(['registrar_baixa_filtro', 'abrir_ordem_servico', 'iniciar_saida_material'])
    // França (mecânico) tem filtros e manutenção, mas NÃO tem saída
    expect(nomes('franca')).toEqual(['registrar_baixa_filtro', 'abrir_ordem_servico'])
    // compras não mexe em filtros, manutenção nem saída: sem ferramentas
    expect(nomes('compras')).toEqual([])
  })

  it('o formato enviado à API não vaza o campo modulo', () => {
    for (const f of ferramentasDoPerfil('admin')) {
      expect(Object.keys(f).sort()).toEqual(['description', 'input_schema', 'name'])
    }
  })
})

describe('iniciar_saida_material — resolução', () => {
  const hoje = new Date(2026, 7, 27) // 27/08/2026
  const ctxSaida = { hoje }

  it('o pedido do print: evento CCUG, joão felipe, de hoje até amanhã', () => {
    const r = resolverAcao('iniciar_saida_material', {
      modalidade: 'evento', nome: 'CCUG', responsavel: 'joao felipe',
      data: 'hoje', previsao_devolucao: 'amanhã',
    }, ctxSaida)
    expect(r.erro).toBeUndefined()
    expect(r.dados.prefill).toMatchObject({
      tipoSaida: 'evento',
      nome: 'CCUG',
      data: '2026-08-27',
      previsao: '2026-08-28',
      responsavel: 'João Felipe Peixoto', // resolvido da lista de operadores
    })
  })

  it('locação mensal usa o tipo interno "locacao" e não tem previsão', () => {
    const r = resolverAcao('iniciar_saida_material', {
      modalidade: 'locacao_mensal', nome: 'Construtora Alfa', previsao_devolucao: 'amanhã',
    }, ctxSaida)
    expect(r.dados.prefill.tipoSaida).toBe('locacao')
    expect(r.dados.prefill.previsao).toBeNull()
  })

  it('responsável ambíguo vira pergunta (Maycon Teixeira × Maykon Souza não confundem)', () => {
    // "maycon" so casa com um (grafias diferentes); "ma" casaria com varios
    const um = resolverAcao('iniciar_saida_material', { modalidade: 'evento', nome: 'X', responsavel: 'maycon' }, ctxSaida)
    expect(um.erro).toBeUndefined()
    expect(um.dados.prefill.responsavel).toBe('Maycon Teixeira')
  })

  it('responsável fora da lista vai como nome livre, sem inventar match', () => {
    const r = resolverAcao('iniciar_saida_material', { modalidade: 'evento', nome: 'X', responsavel: 'Carlos Visitante' }, ctxSaida)
    expect(r.dados.prefill.responsavel).toBe('Carlos Visitante')
  })

  it('datas em vários formatos; ilegível fica para a tela', () => {
    expect(resolverData('2026-09-01')).toBe('2026-09-01')
    expect(resolverData('01/09/2026')).toBe('2026-09-01')
    expect(resolverData('1/9', hoje)).toBe('2026-09-01')
    expect(resolverData('semana que vem', hoje)).toBeNull()
    expect(resolverData('', hoje)).toBeNull()
  })

  it('sem nome ou com modalidade inválida, erro explicável', () => {
    expect(resolverAcao('iniciar_saida_material', { modalidade: 'evento', nome: '  ' }, ctxSaida).erro).toBeTruthy()
    expect(resolverAcao('iniciar_saida_material', { modalidade: 'aluguel', nome: 'X' }, ctxSaida).erro).toBeTruthy()
  })
})
