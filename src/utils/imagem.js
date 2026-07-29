// Utilitario de imagem compartilhado: carrega e comprime fotos para data URL
// (JPEG base64), pequeno o bastante para caber num documento Firestore (limite
// de 1 MB). Fotos de celular de 5-12 MB viram ~80-250 KB, sem Storage/plano pago.
// Mesmo metodo usado nas fotos da OS de Manutencao.

// Carrega um File de imagem num <img> — funciona em qualquer celular (inclui iPhone).
export function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler a imagem')) }
    img.src = url
  })
}

// Comprime a foto e devolve um data URL (JPEG base64). Reduz qualidade e depois
// tamanho ate caber abaixo de maxBytes.
export async function comprimirParaDataUrl(file, maxBytes = 650000, maxLadoInicial = 1280) {
  if (!file?.type?.startsWith('image/')) throw new Error('O arquivo selecionado não é uma imagem.')
  const img = await carregarImagem(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let maxLado = maxLadoInicial
  let qualidade = 0.6
  let dataUrl = ''
  for (let i = 0; i < 9; i++) {
    let { width, height } = img
    const escala = Math.min(1, maxLado / Math.max(width, height))
    width = Math.round(width * escala)
    height = Math.round(height * escala)
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    dataUrl = canvas.toDataURL('image/jpeg', qualidade)
    if (dataUrl.length <= maxBytes) return dataUrl
    if (qualidade > 0.4) qualidade -= 0.1
    else maxLado = Math.round(maxLado * 0.85)
  }
  return dataUrl // melhor esforco (ja bem reduzida)
}
