import { describe, it, expect } from 'vitest'
import {
  diaSeguinte, proximaSegunda, previsaoDoEvento, diasDeAtraso, eventosACobrar, calcularPendencias,
  preventivasVencidas,
} from './pendencias'
import { MODULOS } from '../../utils/permissions'

const HOJE = '2026-08-09' // domingo
const AGORA = new Date(2026, 7, 9, 12, 0, 0)

describe('previsão de devolução', () => {
  it('vira o mês corretamente', () => {
    expect(diaSeguinte('2026-07-31')).toBe('2026-08-01')
    expect(diaSeguinte('2026-02-28')).toBe('2026-03-01')
  })

  it('sugere a próxima segunda, nunca o próprio dia', () => {
    expect(proximaSegunda('2026-08-09')).toBe('2026-08-10') // domingo → segunda
    expect(proximaSegunda('2026-08-10')).toBe('2026-08-17') // segunda → segunda seguinte
    expect(proximaSegunda('2026-08-11')).toBe('2026-08-17') // terça → segunda seguinte
  })

  it('usa o campo gravado quando existe', () => {
    expect(previsaoDoEvento({ data: '2026-08-01', previsaoDevolucao: '2026-08-05' })).toBe('2026-08-05')
  })

  // `data` guarda o dia do LANÇAMENTO da saída, não o do evento: estimar a
  // devolução a partir dela acusava atraso em todo evento antigo.
  it('não estima a partir da data da saída', () => {
    expect(previsaoDoEvento({ data: '2026-08-01' })).toBeNull()
  })

  it('conta o atraso em dias inteiros', () => {
    expect(diasDeAtraso('2026-08-07', HOJE)).toBe(2)
    expect(diasDeAtraso('2026-08-09', HOJE)).toBe(0)
    expect(diasDeAtraso('2026-08-12', HOJE)).toBe(-3)
  })
})

describe('eventos a cobrar', () => {
  const base = { status: 'ativo', nome: 'X', data: '2026-07-01' }

  it('pega evento ativo cuja previsão já passou', () => {
    const r = eventosACobrar([{ ...base, id: '1', previsaoDevolucao: '2026-07-15' }], HOJE)
    expect(r).toHaveLength(1)
    expect(r[0].atraso).toBe(25)
  })

  it('não acusa evento antigo sem o campo, mesmo com data velha', () => {
    const r = eventosACobrar([{ ...base, id: '1', data: '2026-07-14' }], HOJE)
    expect(r).toHaveLength(0)
  })

  it('ignora evento ainda no prazo e o que vence hoje', () => {
    const r = eventosACobrar([
      { ...base, id: '1', previsaoDevolucao: '2026-08-20' },
      { ...base, id: '2', previsaoDevolucao: HOJE },
    ], HOJE)
    expect(r).toHaveLength(0)
  })

  it('ignora concluído e não conta locação nem sublocação', () => {
    const r = eventosACobrar([
      { ...base, id: '1', previsaoDevolucao: '2026-07-01', status: 'concluido' },
      { ...base, id: '2', previsaoDevolucao: '2026-07-01', tipo: 'locacao_mensal' },
      { ...base, id: '3', previsaoDevolucao: '2026-07-01', tipo: 'sublocacao' },
    ], HOJE)
    expect(r).toHaveLength(0)
  })

  it('ordena do mais atrasado para o menos', () => {
    const r = eventosACobrar([
      { ...base, id: '1', previsaoDevolucao: '2026-08-05', nome: 'novo' },
      { ...base, id: '2', previsaoDevolucao: '2026-07-01', nome: 'velho' },
    ], HOJE)
    expect(r.map(x => x.evento.nome)).toEqual(['velho', 'novo'])
  })
})

describe('lista de pendências', () => {
  const dados = {
    eventos: [{ id: '1', nome: 'Dunia', status: 'ativo', data: '2026-07-14', previsaoDevolucao: '2026-07-15' }],
    ordensSaida: [
      { id: 'a', status: 'ativo', tokenAssinatura: 't', assinaturaStatus: 'pendente', numeroFormatado: 'OM-001' },
      { id: 'b', tipo: 'uso_interno', subtipo: 'emprestimo', statusEmprestimo: 'pendente',
        dataPrevistaDevolucao: '2026-08-01', responsavelNome: 'Nilton' },
    ],
    ordensServico: [{ id: 'os1', numero: 'OS-2026-041', status: 'pendente', dataAbertura: new Date(2026, 7, 1) }],
    solicitacoes: [{ id: 's1', status: 'pendente' }],
  }

  it('monta as cinco pendências com os críticos primeiro', () => {
    const r = calcularPendencias(dados, { hoje: HOJE, agora: AGORA })
    expect(r.map(p => p.chave)).toEqual(['cobrar', 'os', 'ferramentas', 'assinatura', 'compras'])
    expect(r[0].nivel).toBe('critico')
    expect(r[0].detalhe).toContain('Dunia')
  })

  it('esconde do perfil o que ele não consegue resolver', () => {
    const soManutencao = m => m === MODULOS.MANUTENCAO
    const r = calcularPendencias(dados, { hoje: HOJE, agora: AGORA, podeVer: soManutencao })
    expect(r.map(p => p.chave)).toEqual(['os'])
  })

  it('não inventa pendência quando está tudo em dia', () => {
    expect(calcularPendencias({}, { hoje: HOJE, agora: AGORA })).toEqual([])
  })

  it('não acusa empréstimo já devolvido nem OS concluída', () => {
    const r = calcularPendencias({
      ordensSaida: [{ tipo: 'uso_interno', subtipo: 'emprestimo', statusEmprestimo: 'devolvido',
        dataPrevistaDevolucao: '2026-08-01' }],
      ordensServico: [{ status: 'concluida', dataAbertura: new Date(2026, 6, 1) }],
    }, { hoje: HOJE, agora: AGORA })
    expect(r).toEqual([])
  })
})

describe('preventivasVencidas', () => {
  const hoje = '2026-09-16'

  it('acusa a vencida e a que vence dentro de uma semana', () => {
    const equipamentos = [
      { id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-10' }, // 6 dias atrasada
      { id: 'b', codigo: 'GG-020', proximaPreventiva: '2026-09-20' }, // vence em 4
      { id: 'c', codigo: 'GG-030', proximaPreventiva: '2026-10-30' }, // longe
      { id: 'd', codigo: 'GG-040' },                                   // sem data
    ]
    const r = preventivasVencidas(equipamentos, [], hoje)
    expect(r.map(x => x.codigo)).toEqual(['GG-015', 'GG-020'])
    // a mais atrasada primeiro — é por ela que o painel resume
    expect(r[0].atraso).toBe(6)
    expect(r[1].atraso).toBe(-4)
  })

  it('caminhão entra pela placa, que é o código dele', () => {
    const r = preventivasVencidas([{ id: 'c1', placa: 'JIL-0122', proximaPreventiva: '2026-09-01' }], [], hoje)
    expect(r[0].codigo).toBe('JIL-0122')
  })

  it('equipamento vendido ou inativo não alerta', () => {
    // Não se faz preventiva no que saiu da frota.
    const equipamentos = [
      { id: 'a', codigo: 'GG-001', proximaPreventiva: '2026-01-01', ativo: false },
      { id: 'b', codigo: 'GG-002', proximaPreventiva: '2026-01-01', status: 'inativo' },
    ]
    expect(preventivasVencidas(equipamentos, [], hoje)).toEqual([])
  })

  it('equipamento com OS ABERTA sai da lista', () => {
    // A manutenção já está encaminhada; repetir aqui empurraria para fora da
    // tela o aviso de quem ainda não foi atendido.
    const equipamentos = [
      { id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-01' },
      { id: 'b', codigo: 'GG-020', proximaPreventiva: '2026-09-01' },
    ]
    const os = [
      { equipamentoId: 'a', status: 'em_andamento' },
      { equipamentoId: 'b', status: 'concluida' },
    ]
    expect(preventivasVencidas(equipamentos, os, hoje).map(x => x.codigo)).toEqual(['GG-020'])
  })

  it('a janela de aviso é configurável e nunca pega o futuro distante', () => {
    const equipamentos = [{ id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-25' }]
    expect(preventivasVencidas(equipamentos, [], hoje, 7)).toEqual([])
    expect(preventivasVencidas(equipamentos, [], hoje, 15)).toHaveLength(1)
  })

  it('aguenta lista vazia e campo ausente', () => {
    expect(preventivasVencidas()).toEqual([])
    expect(preventivasVencidas([], undefined, hoje)).toEqual([])
  })
})

describe('pendência de preventiva no painel', () => {
  const hoje = '2026-09-16'

  it('vencida é crítica; só a vencer é aviso', () => {
    const vencida = calcularPendencias(
      { geradores: [{ id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-10' }] }, { hoje },
    ).find(p => p.chave === 'preventiva')
    expect(vencida.nivel).toBe('critico')
    expect(vencida.detalhe).toContain('atrasado')

    const aVencer = calcularPendencias(
      { geradores: [{ id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-20' }] }, { hoje },
    ).find(p => p.chave === 'preventiva')
    expect(aVencer.nivel).toBe('aviso')
    expect(aVencer.detalhe).toContain('vence em')
  })

  it('junta gerador e caminhão na mesma pendência', () => {
    const p = calcularPendencias({
      geradores: [{ id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-10' }],
      caminhoes: [{ id: 'c', placa: 'JIL-0122', proximaPreventiva: '2026-09-11' }],
    }, { hoje }).find(x => x.chave === 'preventiva')
    expect(p.n).toBe(2)
  })

  it('quem não vê Manutenção não recebe o alerta', () => {
    // Ninguém deve levar cobrança que não consegue resolver.
    const p = calcularPendencias(
      { geradores: [{ id: 'a', codigo: 'GG-015', proximaPreventiva: '2026-09-10' }] },
      { hoje, podeVer: m => m !== MODULOS.MANUTENCAO },
    )
    expect(p.find(x => x.chave === 'preventiva')).toBeUndefined()
  })
})
