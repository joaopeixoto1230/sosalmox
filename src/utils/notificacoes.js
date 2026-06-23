import { db } from '../firebase/config'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

const ZAPI_INSTANCE = import.meta.env.VITE_ZAPI_INSTANCE
const ZAPI_TOKEN = import.meta.env.VITE_ZAPI_TOKEN

export async function enviarWhatsApp(numero, mensagem) {
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) return
  try {
    await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: numero, message: mensagem }),
    })
  } catch {
    // CORS em browser — requer Firebase Function em produção
  }
}

export async function criarNotificacao(uid, mensagem, tipo = 'info', link = '') {
  try {
    await addDoc(collection(db, 'notificacoes'), {
      uid,
      mensagem,
      tipo,
      link,
      lida: false,
      criadoEm: serverTimestamp(),
    })
  } catch { /* silently fail */ }
}

// Notifica todos os usuários de certos perfis (ex: ['admin','compras']).
// É uma notificação coletiva: o sininho mostra para quem tem o perfil e a
// leitura é por usuário (campo lidoPor preenchido no Header).
export async function notificarPerfis(perfis, mensagem, tipo = 'info', link = '') {
  try {
    await addDoc(collection(db, 'notificacoes'), {
      uid: null,
      paraPerfis: perfis,
      mensagem,
      tipo,
      link,
      lida: false,
      lidoPor: [],
      criadoEm: serverTimestamp(),
    })
  } catch { /* silently fail */ }
}

export async function notificarEstoqueBaixo(item) {
  await criarNotificacao('all', `⚠️ Estoque baixo: ${item.nome} (${item.quantidadeAtual} restantes)`, 'aviso', '/filtros')
}

export async function notificarOSAtrasada(os) {
  const FRANCA_NUMERO = import.meta.env.VITE_FRANCA_NUMERO
  const msg = `⚠️ OS #${os.numero} está sem conclusão há 2 dias.\nEquipamento: ${os.equipamentoLabel}`
  if (FRANCA_NUMERO) await enviarWhatsApp(FRANCA_NUMERO, msg)
  if (os.mecanicoUid) await criarNotificacao(os.mecanicoUid, msg, 'urgente', `/manutencao/${os.id}`)
}

export async function criarSolicitacaoCompra(item, tipo = 'filtro') {
  const quantidadeSugerida = Math.max((item.estoqueMin || 0) * 2 - (item.quantidadeAtual || 0), item.estoqueMin || 5)
  try {
    await addDoc(collection(db, 'solicitacoes_compra'), {
      tipo,
      itemId: item.id,
      itemNome: item.nome,
      referencia: item.referencia || '',
      potenciaGG: item.potenciaGG || '',
      fornecedor: item.fornecedor || '',
      quantidadeAtual: item.quantidadeAtual || 0,
      estoqueMin: item.estoqueMin || 0,
      quantidadeSugerida,
      status: 'pendente',
      criadoEm: serverTimestamp(),
    })
  } catch { /* silently fail */ }
}
