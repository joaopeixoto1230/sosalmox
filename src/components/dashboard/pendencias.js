import { MODULOS } from '../../utils/permissions'
import { previsaoRuptura, consumoAnormal, RUPTURA_CRITICA_DIAS } from '../filtros/ruptura'

// ===== Pendências do painel =====
// O que exige ação hoje, calculado a partir do que já existe no banco.
// Cada pendência declara o MÓDULO a que pertence: quem não tem acesso ao módulo
// não vê o alerta, porque não teria como resolvê-lo.

const DIA = 86400000

export function hojeISO(agora = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`
}

export function diaSeguinte(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return ''
  const dt = new Date(a, m - 1, d + 1)
  const p = n => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

// Data em que o material do evento passa a ser cobrado de quem levou.
// ⚠️ NÃO estimar a partir de `data`: esse campo guarda o dia em que a SAÍDA foi
// lançada, não o dia do evento — o evento acontece depois. Estimar dali gerava
// alarme falso em todo evento antigo. Sem o campo preenchido, não há cobrança.
export function previsaoDoEvento(evento) {
  return evento?.previsaoDevolucao || null
}

// Material de evento volta na segunda-feira seguinte (o evento é no fim de
// semana). É só a sugestão inicial do campo — sempre editável na tela.
export function proximaSegunda(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return ''
  const dt = new Date(a, m - 1, d)
  // 1 = segunda; avança até cair na próxima segunda, nunca no mesmo dia
  do { dt.setDate(dt.getDate() + 1) } while (dt.getDay() !== 1)
  const p = n => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export function diasDeAtraso(iso, hoje) {
  if (!iso) return null
  const [a1, m1, d1] = String(iso).split('-').map(Number)
  const [a2, m2, d2] = String(hoje).split('-').map(Number)
  if (!a1 || !a2) return null
  const alvo = new Date(a1, m1 - 1, d1).getTime()
  const ref = new Date(a2, m2 - 1, d2).getTime()
  return Math.round((ref - alvo) / DIA)
}

const ehEvento = e => !e.tipo

// Eventos ativos cuja previsão de devolução já passou: o material continua
// vinculado e precisa ser cobrado de quem levou.
export function eventosACobrar(eventos, hoje) {
  return eventos
    .filter(e => ehEvento(e) && e.status === 'ativo' && previsaoDoEvento(e))
    .map(e => ({ evento: e, atraso: diasDeAtraso(previsaoDoEvento(e), hoje) }))
    .filter(x => x.atraso !== null && x.atraso > 0)
    .sort((a, b) => b.atraso - a.atraso)
}

function osParadas(ordensServico, agora, limiteDias = 2) {
  return ordensServico.filter(o => {
    if (o.status === 'concluida') return false
    const d = o.dataAbertura?.toDate ? o.dataAbertura.toDate() : new Date(o.dataAbertura || 0)
    if (isNaN(d)) return false
    return (agora - d.getTime()) >= limiteDias * DIA
  })
}

function ferramentasAtrasadas(ordensSaida, hoje) {
  return ordensSaida
    .filter(o => o.tipo === 'uso_interno' && o.subtipo === 'emprestimo'
      && (o.statusEmprestimo || 'pendente') === 'pendente')
    .map(o => ({ ordem: o, atraso: diasDeAtraso(o.dataPrevistaDevolucao, hoje) }))
    .filter(x => x.atraso !== null && x.atraso > 0)
    .sort((a, b) => b.atraso - a.atraso)
}

// Saídas de evento entregues sem a assinatura de quem recebeu: sem ela não há
// comprovação de entrega se o material sumir.
function semAssinatura(ordensSaida) {
  return ordensSaida.filter(o => o.tipo !== 'uso_interno'
    && o.status === 'ativo'
    && o.tokenAssinatura
    && o.assinaturaStatus === 'pendente')
}

function comprasNaFila(solicitacoes) {
  return solicitacoes.filter(s => (s.status || 'pendente') === 'pendente')
}

const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`

/**
 * Monta a lista de pendências já ordenada por gravidade.
 * `podeVer(modulo)` filtra o que o perfil consegue resolver.
 */
export function calcularPendencias(dados, opcoes = {}) {
  const agora = opcoes.agora ? opcoes.agora.getTime() : Date.now()
  const hoje = opcoes.hoje || hojeISO(opcoes.agora || new Date())
  const podeVer = opcoes.podeVer || (() => true)

  const {
    eventos = [], ordensSaida = [], ordensServico = [], solicitacoes = [],
    filtros = [], baixasFiltro = [],
  } = dados

  const itens = []

  const cobrar = eventosACobrar(eventos, hoje)
  if (cobrar.length) {
    itens.push({
      chave: 'cobrar',
      modulo: MODULOS.DEVOLUCAO,
      nivel: 'critico',
      n: cobrar.length,
      texto: `${cobrar.length === 1 ? 'evento com material' : 'eventos com material'} a cobrar`,
      detalhe: `mais antigo há ${plural(cobrar[0].atraso, 'dia', 'dias')} — ${cobrar[0].evento.nome}`,
      para: '/devolucao',
      acao: 'Devolução',
    })
  }

  const paradas = osParadas(ordensServico, agora)
  if (paradas.length) {
    itens.push({
      chave: 'os',
      modulo: MODULOS.MANUTENCAO,
      nivel: 'critico',
      n: paradas.length,
      texto: `${paradas.length === 1 ? 'OS aberta' : 'OS abertas'} há mais de 2 dias`,
      detalhe: paradas.slice(0, 3).map(o => o.numero).filter(Boolean).join(', '),
      para: '/manutencao',
      acao: 'Manutenção',
    })
  }

  const ferramentas = ferramentasAtrasadas(ordensSaida, hoje)
  if (ferramentas.length) {
    itens.push({
      chave: 'ferramentas',
      modulo: MODULOS.USO_INTERNO,
      nivel: 'aviso',
      n: ferramentas.length,
      texto: `${ferramentas.length === 1 ? 'ferramenta emprestada' : 'ferramentas emprestadas'} em atraso`,
      detalhe: [...new Set(ferramentas.map(f => f.ordem.responsavelNome).filter(Boolean))].slice(0, 3).join(', '),
      para: '/uso-interno',
      acao: 'Uso Interno',
    })
  }

  const semAss = semAssinatura(ordensSaida)
  if (semAss.length) {
    itens.push({
      chave: 'assinatura',
      modulo: MODULOS.EVENTOS,
      nivel: 'aviso',
      n: semAss.length,
      texto: `${semAss.length === 1 ? 'saída sem assinatura' : 'saídas sem assinatura'} de quem recebeu`,
      detalhe: semAss.slice(0, 3).map(o => o.numeroFormatado).filter(Boolean).join(', '),
      para: '/eventos',
      acao: 'Eventos',
    })
  }

  const compras = comprasNaFila(solicitacoes)
  if (compras.length) {
    itens.push({
      chave: 'compras',
      modulo: MODULOS.FILA_SOLICITACOES,
      nivel: 'aviso',
      n: compras.length,
      texto: `${compras.length === 1 ? 'solicitação de compra' : 'solicitações de compra'} na fila`,
      detalhe: '',
      para: '/solicitacoes',
      acao: 'Solicitações',
    })
  }

  // Avisos proativos de filtros: previsão de ruptura e consumo fora do padrão
  // (filtros/ruptura.js). Números determinísticos — a IA só escreve sobre eles.
  const ruptura = previsaoRuptura(filtros, baixasFiltro, opcoes.agora || new Date())
  if (ruptura.length) {
    const pior = ruptura[0]
    itens.push({
      chave: 'ruptura',
      modulo: MODULOS.FILTROS,
      nivel: pior.diasRestantes <= RUPTURA_CRITICA_DIAS ? 'critico' : 'aviso',
      n: ruptura.length,
      texto: `${ruptura.length === 1 ? 'filtro a caminho' : 'filtros a caminho'} de acabar`,
      detalhe: `no ritmo atual, ${pior.filtro.nome} acaba em ~${plural(pior.diasRestantes, 'dia', 'dias')}`,
      para: '/filtros',
      acao: 'Filtros',
    })
  }

  const anormal = consumoAnormal(filtros, baixasFiltro, opcoes.agora || new Date())
  if (anormal.length) {
    const maior = anormal[0]
    itens.push({
      chave: 'consumo',
      modulo: MODULOS.FILTROS,
      nivel: 'aviso',
      n: anormal.length,
      texto: `${anormal.length === 1 ? 'filtro com consumo' : 'filtros com consumo'} fora do padrão`,
      detalhe: `${maior.filtro.nome}: ${maior.ultimaSemana} na última semana (média ${maior.mediaSemanal.toFixed(1).replace('.', ',')}/sem)`,
      para: '/filtros',
      acao: 'Filtros',
    })
  }

  const ordem = { critico: 0, aviso: 1 }
  return itens
    .filter(i => podeVer(i.modulo))
    .sort((a, b) => (ordem[a.nivel] - ordem[b.nivel]) || (b.n - a.n))
}
