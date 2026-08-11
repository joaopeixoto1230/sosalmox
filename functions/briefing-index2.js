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

  // Estoque baixo (aproximação: regra clássica estoqueAtual <= estoqueMin,
  // aplicável a consumíveis; itens por unidade têm lógica mais fina no app)
  const materiaisBaixo = materiaisBaixoSnap.docs
    .map(d => d.data())
    .filter(m => typeof m.estoqueMin === 'number' && m.estoqueAtual <= m.estoqueMin)

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

function renderHtml(b) {
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

      <h2 style="font-size:16px;border-bottom:2px solid #CC0000;padding-bottom:4px;">⚠️ Alerta de estoque baixo (${b.materiaisBaixo.length})</h2>
      ${li(b.materiaisBaixo, m => `${m.nome || m.codigo || 'item'} — ${m.estoqueAtual ?? '?'} / min ${m.estoqueMin ?? '?'}`)}
      <p style="font-size:11px;color:#999;margin-top:-6px;">Aproximação simples (estoqueAtual ≤ estoqueMin). A tela de Estoque do sistema tem a regra completa por espécie.</p>

      <p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:10px;">
        Gerado automaticamente todo dia às 07h pelo sistema SOS Almoxarifado.
      </p>
    </div>
  </div>`
}

async function enviarBriefing() {
  const b = await buildBriefing()
  const html = renderHtml(b)

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

// Roda todo dia às 07:00 (horário de São Paulo), resumindo as últimas 24h
exports.briefingDiario = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: 'us-central1', secrets: SECRETS },
  async () => {
    await enviarBriefing()
  }
)

// Endpoint HTTP opcional para disparar manualmente e testar (ex: para conferir o
// e-mail antes de confiar 100% no agendamento). Protegido por um token simples.
const TEST_TOKEN = defineSecret('BRIEFING_TEST_TOKEN')
exports.briefingDiarioTeste = onRequest(
  { region: 'us-central1', secrets: [...SECRETS, TEST_TOKEN] },
  async (req, res) => {
    if (req.query.token !== TEST_TOKEN.value()) {
      res.status(403).send('Forbidden')
      return
    }
    await enviarBriefing()
    res.status(200).send('Briefing enviado.')
  }
)
