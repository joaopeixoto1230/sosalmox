import { auth } from '../firebase/config'

// Toda chamada de IA do sistema passa por aqui: o proxy na Cloud Function
// (`agente`, em functions/index.js) guarda a chave da Anthropic no Secret
// Manager e exige usuário logado. A chave NUNCA vai para o navegador —
// a antiga VITE_ANTHROPIC_API_KEY ficava no bundle, exposta a qualquer um.
const URL_AGENTE = 'https://us-central1-sos-almox.cloudfunctions.net/agente'

/**
 * Chama o Claude via proxy. `corpo` segue o formato da API da Anthropic
 * ({ model, system, messages, max_tokens, tools... }) e a resposta idem.
 * Lança Error com mensagem legível quando algo falha.
 */
export async function chamarClaude(corpo) {
  const usuario = auth.currentUser
  if (!usuario) throw new Error('Entre no sistema para usar o agente.')
  const token = await usuario.getIdToken()

  const res = await fetch(URL_AGENTE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(corpo),
  })

  const dados = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detalhe = dados?.error?.message || dados?.error || res.statusText
    throw new Error(`${res.status}: ${detalhe}`)
  }
  return dados
}
