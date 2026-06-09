export const PERFIS = {
  ADMIN: 'admin',
  GERENTE: 'gerente',
  ALMOXARIFE: 'almoxarife',
  FRANCA: 'franca',
  COMPRAS: 'compras',
}

export const MODULOS = {
  DASHBOARD: 'dashboard',
  SAIDA: 'saida',
  DEVOLUCAO: 'devolucao',
  TRANSFERENCIA: 'transferencia',
  ESTOQUE: 'estoque',
  FILTROS: 'filtros',
  GERADORES: 'geradores',
  MANUTENCAO: 'manutencao',
  AGENTE_IA: 'agente_ia',
  RELATORIOS: 'relatorios',
  DASHBOARD_COMPRAS: 'dashboard_compras',
  FILA_SOLICITACOES: 'fila_solicitacoes',
  GESTAO_USUARIOS: 'gestao_usuarios',
  EVENTOS: 'eventos',
}

const permissoes = {
  [PERFIS.ADMIN]: Object.values(MODULOS),
  [PERFIS.GERENTE]: [
    MODULOS.DASHBOARD,
    MODULOS.SAIDA,
    MODULOS.DEVOLUCAO,
    MODULOS.TRANSFERENCIA,
    MODULOS.ESTOQUE,
    MODULOS.FILTROS,
    MODULOS.GERADORES,
    MODULOS.MANUTENCAO,
    MODULOS.AGENTE_IA,
    MODULOS.RELATORIOS,
    MODULOS.DASHBOARD_COMPRAS,
    MODULOS.FILA_SOLICITACOES,
    MODULOS.EVENTOS,
  ],
  [PERFIS.ALMOXARIFE]: [
    MODULOS.DASHBOARD,
    MODULOS.SAIDA,
    MODULOS.DEVOLUCAO,
    MODULOS.TRANSFERENCIA,
    MODULOS.ESTOQUE,
    MODULOS.FILTROS,
    MODULOS.AGENTE_IA,
    MODULOS.RELATORIOS,
    MODULOS.EVENTOS,
  ],
  [PERFIS.FRANCA]: [
    MODULOS.FILTROS,
    MODULOS.GERADORES,
    MODULOS.MANUTENCAO,
    MODULOS.AGENTE_IA,
    MODULOS.RELATORIOS,
  ],
  [PERFIS.COMPRAS]: [
    MODULOS.DASHBOARD_COMPRAS,
    MODULOS.FILA_SOLICITACOES,
  ],
}

export function temPermissao(perfil, modulo) {
  if (!perfil || !modulo) return false
  return permissoes[perfil]?.includes(modulo) ?? false
}

export function getMenuItems(perfil) {
  const todos = [
    { label: 'Dashboard', path: '/dashboard', modulo: MODULOS.DASHBOARD, icon: 'grid' },
    { label: 'Saída de Material', path: '/saida', modulo: MODULOS.SAIDA, icon: 'arrow-up-right' },
    { label: 'Eventos', path: '/eventos', modulo: MODULOS.EVENTOS, icon: 'calendar' },
    { label: 'Devolução', path: '/devolucao', modulo: MODULOS.DEVOLUCAO, icon: 'arrow-down-left' },
    { label: 'Transferência', path: '/transferencia', modulo: MODULOS.TRANSFERENCIA, icon: 'repeat' },
    { label: 'Estoque', path: '/estoque', modulo: MODULOS.ESTOQUE, icon: 'package' },
    { label: 'Filtros', path: '/filtros', modulo: MODULOS.FILTROS, icon: 'filter' },
    { label: 'Geradores', path: '/geradores', modulo: MODULOS.GERADORES, icon: 'zap' },
    { label: 'Manutenção', path: '/manutencao', modulo: MODULOS.MANUTENCAO, icon: 'tool' },
    { label: 'Agente IA', path: '/agente', modulo: MODULOS.AGENTE_IA, icon: 'cpu' },
    { label: 'Relatórios', path: '/relatorios', modulo: MODULOS.RELATORIOS, icon: 'bar-chart' },
    { label: 'Dashboard Compras', path: '/compras', modulo: MODULOS.DASHBOARD_COMPRAS, icon: 'shopping-cart' },
    { label: 'Solicitações', path: '/solicitacoes', modulo: MODULOS.FILA_SOLICITACOES, icon: 'clipboard' },
    { label: 'Usuários', path: '/usuarios', modulo: MODULOS.GESTAO_USUARIOS, icon: 'users' },
  ]
  return todos.filter(item => temPermissao(perfil, item.modulo))
}

export const PERFIL_LABELS = {
  [PERFIS.ADMIN]: 'Administrador',
  [PERFIS.GERENTE]: 'Gerente',
  [PERFIS.ALMOXARIFE]: 'Almoxarife',
  [PERFIS.FRANCA]: 'Mecânico',
  [PERFIS.COMPRAS]: 'Compras',
}

export const PERFIL_CORES = {
  [PERFIS.ADMIN]: 'bg-brand-red text-white',
  [PERFIS.GERENTE]: 'bg-blue-600 text-white',
  [PERFIS.ALMOXARIFE]: 'bg-green-600 text-white',
  [PERFIS.FRANCA]: 'bg-orange-500 text-white',
  [PERFIS.COMPRAS]: 'bg-purple-600 text-white',
}
