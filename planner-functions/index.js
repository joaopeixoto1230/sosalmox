const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')

// Segredo: JSON da service account do projeto sos-almox
const ALMOX_SA = defineSecret('ALMOX_SERVICE_ACCOUNT')

// App do planner (projeto onde a function roda — default)
admin.initializeApp()

// Lazy init do app almox para evitar erro de secret não disponível fora do handler
let almoxDb = null
function getAlmoxDb() {
  if (almoxDb) return almoxDb
  const sa = JSON.parse(ALMOX_SA.value())
  const almoxApp = admin.initializeApp(
    { credential: admin.credential.cert(sa), projectId: 'sos-almox' },
    'almox'
  )
  almoxDb = admin.firestore(almoxApp)
  return almoxDb
}

function mapEvento(data, plannerDocId) {
  const operador = Array.isArray(data.operadores) && data.operadores.length > 0
    ? data.operadores[0]
    : ''

  return {
    nome: data.nomeEvento || '',
    data: data.dataInicio || null,
    dataFim: data.dataFim || null,
    local: data.local || '',
    status: 'agendado',
    operador,
    cliente: data.cliente || '',
    osNumero: data.osNumero || '',
    gerador: data.gerador || '',
    observacoes: data.observacoes || '',
    plannerEventoId: plannerDocId,
    sincronizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }
}

const OPTS = { region: 'us-central1', secrets: [ALMOX_SA] }

// Novo evento criado no Planner → cria no Almoxarifado
exports.onEventoCriado = onDocumentCreated({ document: 'eventos/{docId}', ...OPTS }, async (event) => {
  const snap = event.data
  if (!snap) return
  const mapped = mapEvento(snap.data(), event.params.docId)
  await getAlmoxDb().collection('eventos').doc(event.params.docId).set(mapped)
  console.log(`[sync] criado: ${event.params.docId} → "${mapped.nome}"`)
})

// Evento atualizado no Planner → atualiza no Almoxarifado
exports.onEventoAtualizado = onDocumentUpdated({ document: 'eventos/{docId}', ...OPTS }, async (event) => {
  const after = event.data?.after
  if (!after?.exists) return
  const mapped = mapEvento(after.data(), event.params.docId)
  // merge:true preserva campos que o almox adicionou (ex: materiais vinculados)
  await getAlmoxDb().collection('eventos').doc(event.params.docId).set(mapped, { merge: true })
  console.log(`[sync] atualizado: ${event.params.docId} → "${mapped.nome}"`)
})

// Evento deletado no Planner → marca como cancelado no Almoxarifado (não deleta)
exports.onEventoDeletado = onDocumentDeleted({ document: 'eventos/{docId}', ...OPTS }, async (event) => {
  await getAlmoxDb().collection('eventos').doc(event.params.docId).set(
    { status: 'cancelado', deletadoNoPlannerEm: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  )
  console.log(`[sync] cancelado: ${event.params.docId}`)
})
