export function formatarData(data) {
  if (!data) return '-'
  const d = data?.toDate ? data.toDate() : new Date(data)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarDataHora(data) {
  if (!data) return '-'
  const d = data?.toDate ? data.toDate() : new Date(data)
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
    encerrado: 'Encerrado',
    cancelado: 'Cancelado',
  }
  return map[status] || status
}

export function statusEventoCor(status) {
  const map = {
    ativo: 'bg-green-100 text-green-700',
    agendado: 'bg-blue-100 text-blue-700',
    encerrado: 'bg-gray-100 text-gray-600',
    cancelado: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function statusMaterialLabel(status) {
  const map = {
    disponivel: 'Disponível',
    em_evento: 'Em Evento',
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
    manutencao: 'bg-orange-100 text-orange-700',
    perdido: 'bg-red-100 text-red-700',
    inativo: 'bg-gray-100 text-gray-600',
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
