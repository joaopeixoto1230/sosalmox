import { describe, it, expect } from 'vitest'
import {
  diaSeguinte, previsaoDoEvento, diasDeAtraso, eventosACobrar, calcularPendencias,
} from './pendencias'
import { MODULOS } from '../../utils/permissions'

const HOJE = '2026-08-09'
const AGORA = new Date(2026, 7, 9, 12, 0, 0)

describe('previsão de devolução', () => {
  it('vira o mês corretamente', () => {
    expect(diaSeguinte('2026-07-31')).toBe('2026-08-01')
    expect(diaSeguinte('2026-02-28')).toBe('2026-03-01')
  })

  it('usa o campo gravado quando existe', () => {
    expect(previsaoDoEvento({ data: '2026-08-01', previsaoDevolucao: '2026-08-05' })).toBe('2026-08-05')
  })

  it('cai no dia seguinte ao evento quando o campo não existe (evento antigo)', () => {
    expect(previsaoDoEvento({ data: '2026-08-01' })).toBe('2026-08-02')
  })

  it('conta o atraso em dias inteiros', () => {
    expect(diasDeAtraso('2026-08-07', HOJE)).toBe(2)
    expect(diasDeAtraso('2026-08-09', HOJE)).toBe(0)
    expect(diasDeAtraso('2026-08-12', HOJE)).toBe(-3)
  })
})

describe('eventos a cobrar', () => {
  const base = { status: 'ativo', nome: 'X' }

  it('pega evento ativo cuja previsão já passou', () => {
    const r = eventosACobrar([{ ...base, id: '1', data: '2026-07-14' }], HOJE)
    expect(r).toHaveLength(1)
    expect(r[0].atraso).toBe(25) // devolução prevista para 15/07
  })

  it('ignora evento ainda no prazo e o que vence hoje', () => {
    const r = eventosACobrar([
      { ...base, id: '1', data: '2026-08-20' },
      { ...base, id: '2', data: '2026-08-08' }, // previsão 09/08 = hoje
    ], HOJE)
    expect(r).toHaveLength(0)
  })

  it('ignora concluído e não conta locação nem sublocação', () => {
    const r = eventosACobrar([
      { ...base, id: '1', data: '2026-07-01', status: 'concluido' },
      { ...base, id: '2', data: '2026-07-01', tipo: 'locacao_mensal' },
      { ...base, id: '3', data: '2026-07-01', tipo: 'sublocacao' },
    ], HOJE)
    expect(r).toHaveLength(0)
  })

  it('ordena do mais atrasado para o menos', () => {
    const r = eventosACobrar([
      { ...base, id: '1', data: '2026-08-05', nome: 'novo' },
      { ...base, id: '2', data: '2026-07-01', nome: 'velho' },
    ], HOJE)
    expect(r.map(x => x.evento.nome)).toEqual(['velho', 'novo'])
  })
})

describe('lista de pendências', () => {
  const dados = {
    eventos: [{ id: '1', nome: 'Dunia', status: 'ativo', data: '2026-07-14' }],
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
