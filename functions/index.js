const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')

admin.initializeApp()
const db = admin.firestore()

const GMAIL_USER = defineSecret('GMAIL_USER')
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD')

// E-mail que recebe o briefing diário.
const DESTINATARIO = 'bigpeixoto12@gmail.com'

const SECRETS = [GMAIL_USER, GMAIL_APP_PASSWORD]

// Janela do briefing: últimas 24h
const JANELA_HORAS = 24

function fmtData(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDataHora(ts) {
  const d = ts?.toDate ? ts.toDate() : null
  if (!d) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function buildBriefing() {
  const agora = new Date()
  const inicio = new Date(agora.getTime() - JANELA_HORAS * 60 * 60 * 1000)
  const tsInicio = admin.firestore.Timestamp.fromDate(inicio)

  const [
    ordensSaidaSnap,
    osAbertasSnap,
    osConcluidasSnap,
    solicitacoesSnap,
    entradasFiltroSnap,
    baixasFiltroSnap,
    materiaisBaixoSnap,
  ] = await Promise.all([
    db.collection('ordens_saida').where('criadoEm', '>=', tsInicio).get(),
    db.collection('ordens_servico').where('criadoEm', '>=', tsInicio).get(),
    db.collection('ordens_servico').where('dataConclusao', '>=', tsInicio).get(),
    db.collection('solicitacoes_compra').where('criadoEm', '>=', tsInicio).get(),
    db.collection('entradas_filtro').where('criadoEm', '>=', tsInicio).get(),
    db.collection('baixas_filtro').where('criadoEm', '>=', tsInicio).get(),
    db.collection('materiais').where('status', '==', 'disponivel').get(),
  ])

  // Saídas de material (Evento + Uso Interno)
  const saidas = ordensSaidaSnap.docs.map(d => d.data())
  const saidasEvento = saidas.filter(s => !s.tipo)
  const saidasUsoInterno = saidas.filter(s => s.tipo === 'uso_interno')

  // Ordens de serviço (manutenção)
  const osAbertas = osAbertasSnap.docs.map(d => d.data())
  const osConcluidas = osConcluidasSnap.docs
    .map(d => d.data())
    .filter(os => os.status === 'concluida')

  // Compras
  const solicitacoes = solicitacoesSnap.docs.map(d => d.data())
  const solicitacoesUrgentes = solicitacoes.filter(s => s.urgente)

  // Estoque baixo do e-mail: SO consumiveis (fita, parafuso, protetor), pela
  // regra classica estoqueAtual <= estoqueMin. Material de UNIDADE (cada cabo/
  // jogo/rabicho/ferramenta e um doc 1/1) fica FORA: a comparacao simples
  // marcava todo cabo como baixo (301 itens no e-mail de 28/08/2026) e a
  // leitura da IA amplificava o numero errado. A regra certa para unidade e
  // por especie e mora no app (estoqueEspecie.js) — e cabo nunca alerta.
  const materiaisBaixo = materiaisBaixoSnap.docs
    .map(d => d.data())
    .filter(m => {
      const atual = Number(m.estoqueAtual) || 0
      const minimo = Number(m.estoqueMin) || 0
      const porUnidade = atual <= 1 && minimo <= 1
      if (porUnidade) return false
      return minimo > 0 && atual <= minimo
    })

  const houveMovimento =
    saidasEvento.length + saidasUsoInterno.length + osAbertas.length + osConcluidas.length +
    solicitacoes.length + entradasFiltroSnap.size + baixasFiltroSnap.size > 0

  return {
    inicio,
    agora,
    saidasEvento,
    saidasUsoInterno,
    osAbertas,
    osConcluidas,
    entradasFiltro: entradasFiltroSnap.size,
    baixasFiltro: baixasFiltroSnap.size,
    solicitacoes,
    solicitacoesUrgentes,
    materiaisBaixo,
    houveMovimento,
  }
}

function renderHtml(b, leitura) {
  const li = (arr, render) => arr.length
    ? `<ul style="margin:4px 0 12px;padding-left:20px;">${arr.map(x => `<li style="margin-bottom:4px;">${render(x)}</li>`).join('')}</ul>`
    : `<p style="margin:4px 0 12px;color:#888;">Nada nas últimas 24h.</p>`

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0A0A0A;">
    <div style="background:#CC0000;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">SOS Almoxarifado — Briefing diário</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9;">${fmtData(b.inicio)} a ${fmtData(b.agora)}</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
      ${leitura ? `
      <div style="background:#FFF8F0;border-left:4px solid #CC0000;padding:12px 16px;border-radius:6px;margin-bottom:18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#CC0000;">🤖 Leitura do agente</p>
        <p style="margin:0;font-size:14px;line-height:1.5;">${leitura.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
      </div>` : ''}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">📦 Saídas de material — Evento (${b.saidasEvento.length})</h2>
      ${li(b.saidasEvento, s => `<strong>${s.numeroFormatado || s.numero || ''}</strong> — ${s.eventoNome || 'sem evento'} · ${s.itens?.length || 0} item(ns) · responsável: ${s.responsavelNome || '—'}`)}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">🧰 Saídas — Uso Interno (${b.saidasUsoInterno.length})</h2>
      ${li(b.saidasUsoInterno, s => `<strong>${s.numeroFormatado || s.numero || ''}</strong> — ${s.itens?.length || 0} item(ns) · responsável: ${s.responsavelNome || '—'}`)}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">🔧 Ordens de Serviço abertas (${b.osAbertas.length})</h2>
      ${li(b.osAbertas, os => `<strong>${os.numero || ''}</strong> — ${os.equipamentoLabel || ''} · ${os.tipo || ''} · mecânico: ${os.mecanicoNome || '—'}`)}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">✅ Ordens de Serviço concluídas (${b.osConcluidas.length})</h2>
      ${li(b.osConcluidas, os => `<strong>${os.numero || ''}</strong> — ${os.equipamentoLabel || ''} · concluída em ${fmtDataHora(os.dataConclusao)}`)}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">🛒 Solicitações de compra (${b.solicitacoes.length}${b.solicitacoesUrgentes.length ? `, ${b.solicitacoesUrgentes.length} urgente(s)` : ''})</h2>
      ${li(b.solicitacoes, s => `<strong>${s.numero || s.numeroSeq || ''}</strong> — ${s.itemNome || ''} ${s.urgente ? '⚠️ URGENTE' : ''} · status: ${s.status || '—'}`)}

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">🧯 Filtros — movimentação</h2>
      <p style="margin:4px 0 12px;">${b.entradasFiltro} entrada(s) · ${b.baixasFiltro} baixa(s) nas últimas 24h.</p>

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">⚠️ Consumíveis abaixo do mínimo (${b.materiaisBaixo.length})</h2>
      ${li(b.materiaisBaixo, m => `${m.nome || m.codigo || 'item'} — ${m.estoqueAtual ?? '?'} / min ${m.estoqueMin ?? '?'}`)}
      <p style="font-size:11px;color:#999;margin-top:-6px;">Cabos e itens de unidade não entram aqui: a regra deles é por espécie e está no painel do sistema.</p>

      <p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:10px;">
        Gerado automaticamente todo dia às 07h pelo sistema SOS Almoxarifado. · regras v2
      </p>
    </div>
  </div>`
}

// A IA escreve a "leitura do dia" EM CIMA dos numeros ja apurados pelo
// buildBriefing — ela nao inventa numero nenhum. Se a chamada falhar, o
// briefing sai normalmente, so sem o paragrafo.
async function gerarLeituraIA(b) {
  try {
    const fatos = [
      `Saidas de material para evento nas ultimas 24h: ${b.saidasEvento.length}` +
        (b.saidasEvento.length ? ` (${b.saidasEvento.map(s => s.eventoNome || 'sem evento').join('; ')})` : ''),
      `Saidas de uso interno: ${b.saidasUsoInterno.length}`,
      `OS de manutencao abertas: ${b.osAbertas.length}` +
        (b.osAbertas.length ? ` (${b.osAbertas.map(o => `${o.equipamentoLabel || ''} ${o.tipo || ''}`).join('; ')})` : ''),
      `OS concluidas: ${b.osConcluidas.length}`,
      `Solicitacoes de compra novas: ${b.solicitacoes.length} (${b.solicitacoesUrgentes.length} urgentes)`,
      `Movimentacao de filtros: ${b.entradasFiltro} entradas, ${b.baixasFiltro} baixas`,
      `Consumiveis (fita, parafuso etc.) abaixo do minimo: ${b.materiaisBaixo.length}` +
        (b.materiaisBaixo.length ? ` (${b.materiaisBaixo.slice(0, 8).map(m => m.nome || m.codigo).join('; ')})` : ''),
    ].join('\n')

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY.value(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system:
          'Voce e o assistente do almoxarifado da SOS Energia (locacao de geradores). ' +
          'Escreva a leitura do dia para o dono, Joao, com base APENAS nos fatos fornecidos: ' +
          '3 a 5 frases curtas em portugues, tom direto de colega de trabalho, destacando o que ' +
          'merece atencao hoje e o que esta em ordem. Sem saudacao, sem markdown, sem listas. ' +
          'Se nao houve movimento, diga isso em uma frase e aponte o que segue pendente.',
        messages: [{ role: 'user', content: fatos }],
      }),
    })
    if (!resposta.ok) {
      logger.warn(`leitura IA do briefing falhou: HTTP ${resposta.status}`)
      return null
    }
    const dados = await resposta.json()
    return dados.content?.find(c => c.type === 'text')?.text?.trim() || null
  } catch (e) {
    logger.warn('leitura IA do briefing falhou', e)
    return null
  }
}

async function enviarBriefing() {
  const b = await buildBriefing()
  const leitura = await gerarLeituraIA(b)
  const html = renderHtml(b, leitura)

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER.value(),
      pass: GMAIL_APP_PASSWORD.value(),
    },
  })

  await transporter.sendMail({
    from: `SOS Almoxarifado <${GMAIL_USER.value()}>`,
    to: DESTINATARIO,
    subject: `Report - ${fmtData(b.agora)}`,
    html,
  })

  logger.info(`Briefing diário enviado para ${DESTINATARIO} (movimento: ${b.houveMovimento})`)
}

// ===== Proxy do Agente IA =====
// O chat e o escaneamento de romaneio chamavam a API da Anthropic direto do
// navegador, com a chave embutida no bundle (VITE_ANTHROPIC_API_KEY) — qualquer
// pessoa que abrisse o site conseguia extrair a chave e gastar por fora.
// Este proxy guarda a chave no Secret Manager e só atende usuário logado no
// sistema (Firebase Auth). O frontend chama via utils/agenteApi.js.
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

// Trava contra uso da função por fora do app: só os modelos que o sistema usa,
// e um teto de tokens por resposta.
const MODELOS_PERMITIDOS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5']
const MAX_TOKENS_TETO = 4096 // o scan de romaneio usa 4000
const ORIGENS_PERMITIDAS = [
  'https://sos-almox.web.app',
  'https://sos-almox.firebaseapp.com',
  'http://localhost:5173',
]

exports.agente = onRequest(
  { region: 'us-central1', secrets: [ANTHROPIC_API_KEY], cors: ORIGENS_PERMITIDAS, timeoutSeconds: 120 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: { message: 'Use POST.' } })
      return
    }

    // Só usuário autenticado no sistema usa a chave.
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    let usuario
    try {
      usuario = await admin.auth().verifyIdToken(token)
    } catch {
      res.status(401).json({ error: { message: 'Sessão inválida. Entre de novo no sistema.' } })
      return
    }

    // Corpo em whitelist: nada além do que o app precisa passa adiante.
    const { model, system, messages, max_tokens, tools, tool_choice } = req.body || {}
    if (!MODELOS_PERMITIDOS.includes(model)) {
      res.status(400).json({ error: { message: `Modelo não permitido: ${model}` } })
      return
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: { message: 'Sem mensagens.' } })
      return
    }

    const corpo = {
      model,
      messages,
      max_tokens: Math.min(Number(max_tokens) || 800, MAX_TOKENS_TETO),
      ...(system ? { system } : {}),
      // `tools` fica pronto para o agente que AGE (fase seguinte).
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
      ...(tool_choice ? { tool_choice } : {}),
    }

    try {
      const resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(corpo),
      })
      const dados = await resposta.json().catch(() => ({}))
      logger.info(`agente: ${usuario.email || usuario.uid} model=${model} status=${resposta.status}`)
      res.status(resposta.status).json(dados)
    } catch (e) {
      logger.error('agente: falha ao chamar a Anthropic', e)
      res.status(502).json({ error: { message: 'Falha ao falar com o agente. Tente de novo.' } })
    }
  }
)

// Roda todo dia às 07:00 (horário de São Paulo), resumindo as últimas 24h
exports.briefingDiario = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: 'us-central1', secrets: [...SECRETS, ANTHROPIC_API_KEY] },
  async () => {
    await enviarBriefing()
  }
)

// Endpoint HTTP opcional para disparar manualmente e testar (ex: para conferir o
// e-mail antes de confiar 100% no agendamento). Protegido por um token simples.
const TEST_TOKEN = defineSecret('BRIEFING_TEST_TOKEN')
exports.briefingDiarioTeste = onRequest(
  { region: 'us-central1', secrets: [...SECRETS, ANTHROPIC_API_KEY, TEST_TOKEN] },
  async (req, res) => {
    if (req.query.token !== TEST_TOKEN.value()) {
      res.status(403).send('Forbidden')
      return
    }
    await enviarBriefing()
    res.status(200).send('Briefing enviado.')
  }
)
