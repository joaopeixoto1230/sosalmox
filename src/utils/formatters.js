// Materiais "por quantidade" (consumiveis): saem em varias unidades, nao ficam
// presos a um evento (status nao vira "em_evento") e pedem a quantidade na saida.
// Hoje: protetores de cabo. Detecta pelo tipo OU pelo nome, porque alguns
// protetores foram cadastrados com tipo "Outros Materiais" e so o nome indica.
export function materialPorQuantidade(material) {
  if (!material) return false
  if (material.tipo === 'Protetor de cabo') return true
  return (material.nome || '').toLowerCase().includes('protetor de cabo')
}

export function formatarData(data) {
  if (!data) return '-'
  const d = data?.toDate ? data.toDate() : new Date(data)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarDataHora(data) {
  if (!data) return '-'
  const d = data?.toDate ? data.toDate() : new Date(data)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatarNumeroOrdem(numero) {
  const ano = new Date().getFullYear()
  return `OM-${ano}-${String(numero).padStart(3, '0')}`
}

export function statusEventoLabel(status) {
  const map = {
    ativo: 'Ativo',
    agendado: 'Agendado',
    concluido: 'Concluído',
    encerrado: 'Encerrado',
    cancelado: 'Cancelado',
  }
  return map[status] || status
}

export function statusEventoCor(status) {
  const map = {
    ativo: 'bg-green-100 text-green-700',
    agendado: 'bg-blue-100 text-blue-700',
    concluido: 'bg-gray-100 text-gray-600',
    encerrado: 'bg-gray-100 text-gray-600',
    cancelado: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function statusMaterialLabel(status) {
  const map = {
    disponivel: 'Disponível',
    em_evento: 'Em Evento',
    emprestado: 'Emprestado',
    consumido: 'Consumido',
    manutencao: 'Manutenção',
    perdido: 'Perdido',
    inativo: 'Inativo',
  }
  return map[status] || status
}

export function statusMaterialCor(status) {
  const map = {
    disponivel: 'bg-green-100 text-green-700',
    em_evento: 'bg-yellow-100 text-yellow-700',
    emprestado: 'bg-indigo-100 text-indigo-700',
    consumido: 'bg-gray-200 text-gray-600',
    manutencao: 'bg-orange-100 text-orange-700',
    perdido: 'bg-red-100 text-red-700',
    inativo: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

// Status de devolucao (compartilhado entre devolucao de Evento e Emprestimo).
// 'nao_devolvido' e novo, so usado no Emprestimo (ferramenta que nao voltou).
export function statusDevolucaoLabel(status) {
  const map = {
    ok: 'Devolvido OK',
    problema: 'Com problema',
    cortado: 'Cortado',
    perdido: 'Perdido',
    nao_devolvido: 'Não devolvido',
    aguardando: 'Aguardando',
  }
  return map[status] || status
}

export function statusDevolucaoCor(status) {
  const map = {
    ok: 'bg-green-100 text-green-700',
    problema: 'bg-orange-100 text-orange-700',
    cortado: 'bg-gray-200 text-gray-700',
    perdido: 'bg-red-100 text-red-700',
    nao_devolvido: 'bg-red-100 text-red-700',
    aguardando: 'bg-gray-100 text-gray-500',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function statusGeradorLabel(status) {
  const map = {
    disponivel: 'Disponível',
    em_evento: 'Em Evento',
    locacao: 'Em Locação',
    manutencao: 'Em Manutenção',
    defeito: 'Com Defeito',
    inativo: 'Inativo',
  }
  return map[status] || status
}

export function statusGeradorCor(status) {
  const map = {
    disponivel: 'bg-green-100 text-green-700',
    em_evento: 'bg-blue-100 text-blue-700',
    locacao: 'bg-purple-100 text-purple-700',
    manutencao: 'bg-orange-100 text-orange-700',
    defeito: 'bg-red-100 text-red-700',
    inativo: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

// Veiculos sao separados em caminhao | carro. O campo `tipo` guarda isso. Para os
// veiculos importados antes dessa separacao (sem `tipo`), inferimos pelo modelo:
// Strada e Fiorino sao carros; o resto, caminhao. Veiculos novos/editados gravam o
// `tipo` explicitamente, entao a inferencia so vale como fallback dos antigos.
const MODELOS_CARRO = ['strada', 'fiorino']

export function tipoVeiculo(v) {
  if (v?.tipo === 'carro' || v?.tipo === 'caminhao') return v.tipo
  const txt = `${v?.modelo || ''} ${v?.observacao || ''}`.toLowerCase()
  return MODELOS_CARRO.some(m => txt.includes(m)) ? 'carro' : 'caminhao'
}

export function tipoVeiculoLabel(tipo) {
  return tipo === 'carro' ? 'Carro' : 'Caminhão'
}

// Caminhao/carro mede KM (hodometro), nao horimetro. Os campos novos sao kmAtual
// e semKm; estes helpers leem com fallback para os campos antigos (horimetroAtual/
// semHorimetro) dos caminhoes importados antes da troca, evitando migracao.
export function caminhaoSemKm(c) {
  return c?.semKm ?? c?.semHorimetro ?? false
}

export function caminhaoKm(c) {
  return c?.kmAtual ?? c?.horimetroAtual ?? null
}

// Caminhao com gerador montado: quando o gerador vai a evento/locacao, ele segue
// fisicamente em cima do caminhao, entao o caminhao acompanha esse status. Defeito
// e manutencao do gerador NAO afetam o caminhao (sao da maquina, nao do veiculo).
// Condicoes do proprio caminhao (defeito/manutencao) sempre prevalecem.
const ESTADOS_ACOMPANHA = ['em_evento', 'locacao']

export function caminhaoAcompanhaGerador(caminhao, gerador) {
  if (!gerador) return false
  const proprio = caminhao?.status || 'disponivel'
  if (caminhao?.temDefeito || proprio === 'defeito' || proprio === 'manutencao') return false
  return ESTADOS_ACOMPANHA.includes(gerador.status)
}

export function statusEfetivoCaminhao(caminhao, gerador) {
  const proprio = caminhao?.status || 'disponivel'
  if (caminhao?.temDefeito || proprio === 'defeito' || proprio === 'manutencao') return proprio
  if (gerador && ESTADOS_ACOMPANHA.includes(gerador.status)) return gerador.status
  return proprio
}

export function statusOsLabel(status) {
  const map = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  }
  return map[status] || status
}

export function statusOsCor(status) {
  const map = {
    pendente: 'bg-yellow-100 text-yellow-700',
    em_andamento: 'bg-blue-100 text-blue-700',
    concluida: 'bg-green-100 text-green-700',
    cancelada: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function formatarNumeroOS(numero) {
  const ano = new Date().getFullYear()
  return `OS-${ano}-${String(numero).padStart(3, '0')}`
}

export function statusFiltroLabel(qtd, min) {
  if (qtd <= 0) return 'Crítico'
  if (qtd <= min) return 'Baixo'
  return 'OK'
}

export function statusFiltroCor(qtd, min) {
  if (qtd <= 0) return 'bg-red-100 text-red-700'
  if (qtd <= min) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}
