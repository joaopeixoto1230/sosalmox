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
  CAMINHOES: 'caminhoes',
  MANUTENCAO: 'manutencao',
  AGENTE_IA: 'agente_ia',
  RELATORIOS: 'relatorios',
  DASHBOARD_COMPRAS: 'dashboard_compras',
  FILA_SOLICITACOES: 'fila_solicitacoes',
  GESTAO_USUARIOS: 'gestao_usuarios',
  EVENTOS: 'eventos',
  LOCACOES: 'locacoes',
  USO_INTERNO: 'uso_interno',
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
    MODULOS.CAMINHOES,
    MODULOS.MANUTENCAO,
    MODULOS.AGENTE_IA,
    MODULOS.RELATORIOS,
    MODULOS.DASHBOARD_COMPRAS,
    MODULOS.FILA_SOLICITACOES,
    MODULOS.EVENTOS,
    MODULOS.LOCACOES,
    MODULOS.USO_INTERNO,
  ],
  [PERFIS.ALMOXARIFE]: [
    MODULOS.DASHBOARD,
    MODULOS.SAIDA,
    MODULOS.DEVOLUCAO,
    MODULOS.TRANSFERENCIA,
    MODULOS.ESTOQUE,
    MODULOS.FILTROS,
    MODULOS.GERADORES,
    MODULOS.CAMINHOES,
    MODULOS.MANUTENCAO,
    MODULOS.AGENTE_IA,
    MODULOS.RELATORIOS,
    MODULOS.EVENTOS,
    MODULOS.LOCACOES,
    MODULOS.DASHBOARD_COMPRAS,
    MODULOS.FILA_SOLICITACOES,
    MODULOS.USO_INTERNO,
  ],
  [PERFIS.FRANCA]: [
    MODULOS.FILTROS,
    MODULOS.GERADORES,
    MODULOS.CAMINHOES,
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
    // Grupo: um item pai que expande. A visibilidade vem dos FILHOS, nunca de
    // um módulo próprio — o mecânico tem Filtros mas não Estoque, e herdar a
    // permissão do pai o deixaria sem Filtros no menu.
    {
      label: 'Eventos e Locações',
      icon: 'calendar',
      filhos: [
        { label: 'Eventos', path: '/eventos', modulo: MODULOS.EVENTOS },
        { label: 'Locações mensais', path: '/locacoes', modulo: MODULOS.LOCACOES },
        { label: 'Sublocações', path: '/sublocacoes', modulo: MODULOS.LOCACOES },
      ],
    },
    { label: 'Devolução', path: '/devolucao', modulo: MODULOS.DEVOLUCAO, icon: 'arrow-down-left' },
    { label: 'Transferência', path: '/transferencia', modulo: MODULOS.TRANSFERENCIA, icon: 'repeat' },
    {
      label: 'Estoque',
      icon: 'package',
      filhos: [
        { label: 'Materiais', path: '/estoque', modulo: MODULOS.ESTOQUE },
        { label: 'Filtros', path: '/filtros', modulo: MODULOS.FILTROS },
        { label: 'Uso Interno', path: '/uso-interno', modulo: MODULOS.USO_INTERNO },
      ],
    },
    { label: 'Geradores', path: '/geradores', modulo: MODULOS.GERADORES, icon: 'zap' },
    { label: 'Veículos', path: '/caminhoes', modulo: MODULOS.CAMINHOES, icon: 'truck' },
    { label: 'Manutenção', path: '/manutencao', modulo: MODULOS.MANUTENCAO, icon: 'tool' },
    { label: 'Agente IA', path: '/agente', modulo: MODULOS.AGENTE_IA, icon: 'cpu' },
    { label: 'Relatórios', path: '/relatorios', modulo: MODULOS.RELATORIOS, icon: 'bar-chart' },
    { label: 'Dashboard Compras', path: '/compras', modulo: MODULOS.DASHBOARD_COMPRAS, icon: 'shopping-cart' },
    { label: 'Solicitações', path: '/solicitacoes', modulo: MODULOS.FILA_SOLICITACOES, icon: 'clipboard' },
    { label: 'Usuários', path: '/usuarios', modulo: MODULOS.GESTAO_USUARIOS, icon: 'users' },
  ]
  return todos
    .map(item => item.filhos
      ? { ...item, filhos: item.filhos.filter(f => temPermissao(perfil, f.modulo)) }
      : item)
    // grupo aparece se sobrou algum filho; item solto, pela própria permissão
    .filter(item => item.filhos ? item.filhos.length > 0 : temPermissao(perfil, item.modulo))
    // grupo com um filho só vira item comum: expander para uma opção é ruído
    .map(item => item.filhos?.length === 1
      ? { label: item.filhos[0].label, path: item.filhos[0].path, modulo: item.filhos[0].modulo, icon: item.icon }
      : item)
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
