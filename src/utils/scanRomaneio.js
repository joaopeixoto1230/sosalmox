// Leitura de romaneio manuscrito por visao (Claude).
//
// O colaborador anota a saida no papel (cabos, caixas, rabichos, quantidades) e
// aqui a foto vira uma lista estruturada de itens. Reaproveita a MESMA integracao
// do AgenteChat: VITE_ANTHROPIC_API_KEY + acesso direto do navegador. So a leitura
// usa um modelo mais forte (Sonnet) porque a caligrafia e dificil; o chat continua
// no Haiku. O resultado NUNCA e lancado automaticamente: passa sempre pela tela de
// conferencia (ScanPapelModal), onde o colaborador confirma/corrige.

const CATEGORIAS = ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

const PROMPT = `Voce le romaneios MANUSCRITOS do almoxarifado da SOS Energia (locacao de geradores).
A foto e uma lista de materiais que um colaborador anotou a mao para dar SAIDA a um evento.

Extraia SOMENTE as linhas de material. IGNORE titulos, nomes de pessoas, nomes de evento,
datas, chaves/colchetes e qualquer texto que nao seja um item de material.

Notacao comum da equipe (exemplos reais):
- "01 CABO 4x16/64 24m"  -> quantidade 1, bitola "4x16", metragem "24m"
- "03 CAIXA DE DESCONEXAO" -> quantidade 3, sem bitola/metragem
- "01 RABICHO 120/39/8m"  -> quantidade 1, bitola "120", metragem "8m"
- "70/63/5m" (repeticao do item de cima, aspas) -> mesmo material do de cima, bitola "70", metragem "5m"
- "01 REVERSORA" -> Chave Reversora
O numero no inicio da linha (ex "01", "03", "0l" que costuma ser 01) e a QUANTIDADE.
Aspas verticais/ditto ("//", "\\"") significam "repete o material da linha de cima" — nesse caso
repita a mesma descricao base, mudando so bitola/metragem/quantidade da linha atual.

Para cada item devolva um objeto:
{
  "quantidade": <numero inteiro, 1 se nao houver>,
  "descricao": "<texto legivel do item, ex 'Cabo 4x16 24m', 'Caixa de desconexao', 'Rabicho terra 95 6m'>",
  "bitola": "<ex '4x16', '70', '5x10'>" ou null,
  "metragem": "<ex '24m', '5m'>" ou null,
  "categoria": "<uma de: ${CATEGORIAS.join(', ')}>" ou null,
  "confianca": "<alta|media|baixa: quao seguro voce esta da leitura desta linha>"
}

Responda APENAS com o array JSON, sem texto antes ou depois, sem blocos de codigo.
Se a foto nao tiver nenhum material legivel, responda [].`

// Extrai o array JSON da resposta do modelo (tolerante a cercas ```json e a texto solto).
function parseItens(texto) {
  if (!texto) return []
  let t = texto.trim()
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const ini = t.indexOf('[')
  const fim = t.lastIndexOf(']')
  if (ini === -1 || fim === -1 || fim < ini) return []
  try {
    const arr = JSON.parse(t.slice(ini, fim + 1))
    if (!Array.isArray(arr)) return []
    return arr
      .filter(o => o && (o.descricao || o.bitola))
      .map(o => ({
        quantidade: Number.isFinite(+o.quantidade) && +o.quantidade > 0 ? Math.round(+o.quantidade) : 1,
        descricao: String(o.descricao || '').trim(),
        bitola: o.bitola ? String(o.bitola).trim() : null,
        metragem: o.metragem ? String(o.metragem).trim() : null,
        categoria: CATEGORIAS.includes(o.categoria) ? o.categoria : null,
        confianca: ['alta', 'media', 'baixa'].includes(o.confianca) ? o.confianca : 'media',
      }))
  } catch {
    return []
  }
}

const MEDIA_SUPORTADAS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Recebe o base64 PURO (sem o prefixo data:) e o media type da foto.
export async function escanearRomaneio(imagemBase64, mediaType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Leitura por IA nao configurada. Adicione VITE_ANTHROPIC_API_KEY no .env.')

  const media = MEDIA_SUPORTADAS.includes(mediaType) ? mediaType : 'image/jpeg'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: imagemBase64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!res.ok) {
    let detalhe = ''
    try { detalhe = (await res.text()).slice(0, 200) } catch { /* ignore */ }
    throw new Error(`Falha ao ler a foto (HTTP ${res.status}). ${detalhe}`)
  }

  const data = await res.json()
  const texto = data?.content?.find(b => b.type === 'text')?.text || data?.content?.[0]?.text || ''
  return parseItens(texto)
}

// --- Casamento com o estoque -------------------------------------------------

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const compacto = s => normalizar(s).replace(/ /g, '')

// Palavras genericas que nao ajudam a distinguir um material de outro.
const STOPWORDS = new Set(['cabo', 'de', 'com', 'da', 'do', 'e', 'para', 'un', 'm', 'mts', 'metros'])

// Tenta achar no estoque o material que melhor corresponde a um item lido do papel.
// Retorna { material, score } do melhor candidato, ou null se nada for suficiente.
// A decisao final e sempre do colaborador na tela de conferencia.
export function casarMaterial(item, materiais) {
  const alvoBitola = compacto(item.bitola || '')
  const alvoMetragem = compacto(item.metragem || '')
  const tokensDesc = normalizar(item.descricao)
    .split(' ')
    .filter(t => t.length >= 2 && !STOPWORDS.has(t))

  let melhor = null
  for (const m of materiais) {
    if (m.status === 'inativo') continue
    const hay = normalizar(`${m.nome} ${m.codigo} ${m.bitola || ''} ${m.metragem || ''} ${m.tipo || ''}`)
    const hayComp = hay.replace(/ /g, '')

    let score = 0
    if (alvoBitola && hayComp.includes(alvoBitola)) score += 5
    if (alvoMetragem && hayComp.includes(alvoMetragem)) score += 5
    for (const tk of tokensDesc) if (hay.includes(tk)) score += 1

    if (!melhor || score > melhor.score) melhor = { material: m, score }
  }

  // Exige sinal forte: pelo menos bitola OU metragem batendo, ou varios tokens.
  return melhor && melhor.score >= 5 ? melhor : null
}
