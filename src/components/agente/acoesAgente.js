import { MODULOS, temPermissao } from '../../utils/permissions'
import { OPERADORES } from '../../utils/operadores'
import { normalizar } from '../estoque/sugestaoGrupo'

// ===== Ações do agente que AGE — parte PURA =====
//
// Definições das ferramentas (formato da API) e a resolução do pedido em
// linguagem natural para a operação concreta (qual filtro, qual equipamento).
// NADA aqui toca o Firestore — a execução fica em ferramentas.js. A separação
// existe para esta parte, que é onde mora a chance de pegar o item errado,
// ser coberta por teste.

export const DEFINICOES = [
  {
    name: 'registrar_baixa_filtro',
    modulo: MODULOS.FILTROS,
    description:
      'Registra a baixa (consumo) de um filtro do estoque de filtros. Use quando o usuário pedir para dar baixa, consumir ou descontar filtros. A operação só acontece depois que o usuário confirmar na tela.',
    input_schema: {
      type: 'object',
      properties: {
        filtro: { type: 'string', description: 'Nome, referência ou parte do nome do filtro (ex: "filtro de óleo", "WEGA123")' },
        potencia: { type: 'string', description: 'Potência do gerador dono do filtro, se o usuário citou (ex: "110kVA", "500")' },
        quantidade: { type: 'integer', description: 'Quantas unidades dar baixa' },
        motivo: { type: 'string', description: 'Motivo da baixa, se o usuário citou (ex: troca do GG-45)' },
      },
      required: ['filtro', 'quantidade'],
    },
  },
  {
    name: 'abrir_ordem_servico',
    modulo: MODULOS.MANUTENCAO,
    description:
      'Abre uma Ordem de Serviço de manutenção para um gerador (GG-xxx) ou veículo (placa). Use quando o usuário pedir para abrir OS, mandar para manutenção ou registrar um defeito para conserto. A OS nasce pendente, sem filtros — eles são adicionados depois pela tela da OS. A operação só acontece depois que o usuário confirmar na tela.',
    input_schema: {
      type: 'object',
      properties: {
        equipamento: { type: 'string', description: 'Código do gerador (ex: GG-45) ou placa do veículo' },
        tipo: { type: 'string', enum: ['preventiva', 'corretiva'], description: 'Tipo da manutenção' },
        descricao: { type: 'string', description: 'Descrição do serviço/problema, nas palavras do usuário' },
        mecanico: { type: 'string', description: 'Mecânico responsável, se o usuário citou (Nilton Fernandes, Fabio Alves ou Andre França)' },
      },
      required: ['equipamento', 'tipo', 'descricao'],
    },
  },
  {
    name: 'iniciar_saida_material',
    modulo: MODULOS.SAIDA,
    description:
      'Abre a tela de Saída de Material com o passo 1 já preenchido (modalidade, evento/cliente, local, data, responsável, previsão de devolução). A saída NÃO é gravada por aqui: o usuário continua na tela — escolhe os materiais e geradores, confere o romaneio e colhe as assinaturas obrigatórias. Use quando o usuário pedir para abrir/lançar/criar uma saída de material.',
    input_schema: {
      type: 'object',
      properties: {
        modalidade: { type: 'string', enum: ['evento', 'locacao_mensal', 'sublocacao'], description: 'Tipo da saída' },
        nome: { type: 'string', description: 'Nome do evento (ou do cliente/contrato, em locação e sublocação)' },
        local: { type: 'string', description: 'Local do evento/obra, se o usuário citou' },
        data: { type: 'string', description: 'Data da saída: AAAA-MM-DD, "hoje" ou "amanhã"' },
        previsao_devolucao: { type: 'string', description: 'Previsão de devolução do material (só para evento): AAAA-MM-DD, "hoje" ou "amanhã"' },
        responsavel: { type: 'string', description: 'Quem leva o material, se o usuário citou' },
      },
      required: ['modalidade', 'nome'],
    },
  },
]

/** Ferramentas que este perfil pode usar, no formato da API (sem o campo modulo). */
export function ferramentasDoPerfil(perfil) {
  return DEFINICOES
    .filter(d => temPermissao(perfil, d.modulo))
    // o campo modulo e nosso, nao vai para a API
    .map(d => ({ name: d.name, description: d.description, input_schema: d.input_schema }))
}

/** Instrução extra do system prompt quando há ferramentas disponíveis. */
export function instrucaoFerramentas(nomes) {
  if (!nomes.length) return ''
  return `
FERRAMENTAS: você pode executar operações reais no sistema (${nomes.join(', ')}). Regras:
- Só use ferramenta quando o usuário PEDIR uma ação, nunca por iniciativa própria.
- Toda operação passa por uma tela de confirmação antes de gravar — monte a operação com o que o usuário deu e deixe a confirmação para ele.
- Se faltar informação essencial (qual filtro, quantidade, qual equipamento), pergunte antes de chamar a ferramenta.
- Após o resultado da ferramenta, confirme em UMA frase o que foi feito (ou explique o erro).`
}

// ===== Resolução + execução =====

const digitos = s => String(s || '').replace(/\D/g, '')

function acharFiltro(filtros, entrada) {
  const busca = normalizar(entrada.filtro)
  const pot = digitos(entrada.potencia)
  const candidatos = filtros.filter(f => {
    const alvo = `${normalizar(f.nome)} ${normalizar(f.referencia)}`
    const bateTexto = busca.split(/\s+/).every(palavra => alvo.includes(palavra))
    const batePot = !pot || digitos(f.potenciaGG).includes(pot)
    return bateTexto && batePot
  })
  // Mesma referência em várias potências = estoque compartilhado: é UM estoque,
  // qualquer um dos docs serve de base (a transação aplica em todos os iguais).
  const porReferencia = new Map()
  for (const f of candidatos) {
    const chave = normalizar(f.referencia) || normalizar(f.nome)
    if (!porReferencia.has(chave)) porReferencia.set(chave, f)
  }
  return [...porReferencia.values()]
}

function acharEquipamento(geradores, veiculos, texto) {
  const d = digitos(texto)
  const t = normalizar(texto)
  if (d && /gg/.test(t)) {
    const gg = geradores.find(g => digitos(g.codigo) === d.padStart(3, '0') || digitos(g.codigo) === d)
    if (gg) return { tipo: 'gerador', doc: gg }
  }
  const placa = t.replace(/[^a-z0-9]/g, '')
  const veiculo = veiculos.find(v => normalizar(v.placa).replace(/[^a-z0-9]/g, '') === placa && placa)
  if (veiculo) return { tipo: 'caminhao', doc: veiculo }
  // último recurso: gerador só por número
  if (d) {
    const gg = geradores.find(g => digitos(g.codigo) === d.padStart(3, '0'))
    if (gg) return { tipo: 'gerador', doc: gg }
  }
  return null
}


/**
 * Resolve a chamada da ferramenta para uma operação concreta.
 * Devolve { erro } (o texto volta ao modelo, que pergunta ao usuário) ou
 * { titulo, linhas, dados } — `dados` é o que a execução precisa.
 */
export function resolverAcao(nomeFerramenta, entrada, ctx) {
  if (nomeFerramenta === 'registrar_baixa_filtro') return resolverBaixaFiltro(entrada, ctx)
  if (nomeFerramenta === 'abrir_ordem_servico') return resolverAbrirOS(entrada, ctx)
  if (nomeFerramenta === 'iniciar_saida_material') return resolverIniciarSaida(entrada, ctx)
  return { erro: `Ferramenta desconhecida: ${nomeFerramenta}` }
}

// "hoje"/"amanhã", AAAA-MM-DD ou DD/MM[/AAAA] -> AAAA-MM-DD (null se não der).
export function resolverData(texto, hoje = new Date()) {
  const t = normalizar(texto)
  if (!t) return null
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (t === 'hoje') return iso(hoje)
  if (t === 'amanha') { const d = new Date(hoje); d.setDate(d.getDate() + 1); return iso(d) }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const br = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (br) {
    const ano = br[3] ? (br[3].length === 2 ? `20${br[3]}` : br[3]) : String(hoje.getFullYear())
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  return null
}

const TIPO_SAIDA = { evento: 'evento', locacao_mensal: 'locacao', sublocacao: 'sublocacao' }
const NOME_MODALIDADE = { evento: 'Evento', locacao_mensal: 'Locação Mensal', sublocacao: 'Sublocação' }

function resolverIniciarSaida(entrada, ctx = {}) {
  const tipoSaida = TIPO_SAIDA[entrada.modalidade]
  if (!tipoSaida) return { erro: 'Modalidade deve ser evento, locacao_mensal ou sublocacao.' }
  const nome = String(entrada.nome || '').trim()
  if (!nome) return { erro: 'Falta o nome do evento (ou do cliente).' }

  const hoje = ctx.hoje || new Date()
  const data = resolverData(entrada.data, hoje)
  const previsao = tipoSaida === 'evento' ? resolverData(entrada.previsao_devolucao, hoje) : null

  // Responsável casa com a lista de operadores; sem casar, vai como nome livre
  // (o "+ Outro" da tela). Mais de um casando é pergunta, não escolha nossa.
  let responsavel = String(entrada.responsavel || '').trim()
  if (responsavel && tipoSaida !== 'sublocacao') {
    const busca = normalizar(responsavel)
    const casados = OPERADORES.filter(op => busca.split(/\s+/).every(p => normalizar(op).includes(p)))
    if (casados.length === 1) responsavel = casados[0]
    else if (casados.length > 1) {
      return { erro: `Mais de um operador casa com "${entrada.responsavel}": ${casados.join('; ')}. Pergunte qual.` }
    }
  }

  return {
    titulo: 'Abrir Saída de Material preenchida',
    linhas: [
      ['Modalidade', NOME_MODALIDADE[entrada.modalidade]],
      [tipoSaida === 'evento' ? 'Evento' : 'Cliente', nome],
      ['Local', entrada.local?.trim() || 'preencher na tela'],
      ['Data', data || 'preencher na tela'],
      ...(tipoSaida === 'evento' ? [['Previsão de devolução', previsao || 'sugerida na tela']] : []),
      ['Responsável', responsavel || 'escolher na tela'],
    ],
    // A tela é aberta com isso preenchido; materiais, romaneio e assinaturas
    // continuam no fluxo normal — nada é gravado por aqui.
    dados: { prefill: { tipoSaida, nome, local: entrada.local?.trim() || '', data, previsao, responsavel } },
  }
}

function resolverBaixaFiltro(entrada, { filtros }) {
  const qtd = Math.floor(Number(entrada.quantidade))
  if (!qtd || qtd <= 0) return { erro: 'Quantidade inválida.' }

  const achados = acharFiltro(filtros, entrada)
  if (achados.length === 0) {
    return { erro: `Nenhum filtro encontrado para "${entrada.filtro}"${entrada.potencia ? ` (${entrada.potencia})` : ''}. Peça ao usuário o nome ou a referência exata.` }
  }
  if (achados.length > 1) {
    const nomes = achados.slice(0, 5).map(f => `${f.nome}${f.potenciaGG ? ` (${f.potenciaGG})` : ''}`).join('; ')
    return { erro: `Mais de um filtro casa com "${entrada.filtro}": ${nomes}. Pergunte ao usuário qual é.` }
  }

  const filtro = achados[0]
  const estoque = Number(filtro.quantidadeAtual) || 0
  if (qtd > estoque) {
    return { erro: `${filtro.nome} tem só ${estoque} em estoque — não dá para baixar ${qtd}.` }
  }

  return {
    titulo: 'Registrar baixa de filtro',
    linhas: [
      ['Filtro', `${filtro.nome}${filtro.potenciaGG ? ` (${filtro.potenciaGG})` : ''}`],
      ['Referência', filtro.referencia || '—'],
      ['Quantidade', `${qtd} (estoque: ${estoque} → ${estoque - qtd})`],
      ['Motivo', entrada.motivo || 'Baixa via agente'],
    ],
    dados: { filtro, qtd, motivo: entrada.motivo || '' },
  }
}

function resolverAbrirOS(entrada, { geradores, veiculos }) {
  if (!['preventiva', 'corretiva'].includes(entrada.tipo)) return { erro: 'Tipo deve ser preventiva ou corretiva.' }
  if (!String(entrada.descricao || '').trim()) return { erro: 'Falta a descrição do serviço.' }

  const achado = acharEquipamento(geradores, veiculos, entrada.equipamento)
  if (!achado) {
    return { erro: `Equipamento "${entrada.equipamento}" não encontrado. Peça o código do gerador (GG-xxx) ou a placa do veículo.` }
  }

  const { tipo: equipamentoTipo, doc: equip } = achado
  const label = equipamentoTipo === 'gerador'
    ? equip.codigo
    : `${equip.placa || ''}${equip.modelo ? ` — ${equip.modelo}` : ''}`
  // Gerador que está com cliente (locação/sublocação) não muda de status nem de
  // lugar — mesma regra da NovaOS (local "locação").
  const foraComCliente = equipamentoTipo === 'gerador' && ['locacao', 'sublocado'].includes(equip.status)

  return {
    titulo: 'Abrir Ordem de Serviço',
    linhas: [
      ['Equipamento', label],
      ['Tipo', entrada.tipo],
      ['Descrição', entrada.descricao.trim()],
      ['Mecânico', entrada.mecanico || 'a definir'],
      ['Local', foraComCliente ? `No cliente (${equip.eventoNome || 'locação'})` : 'Pátio SOS'],
    ],
    dados: {
      equip,
      equipamentoTipo,
      label,
      foraComCliente,
      tipo: entrada.tipo,
      descricao: entrada.descricao.trim(),
      mecanico: entrada.mecanico || null,
    },
  }
}
