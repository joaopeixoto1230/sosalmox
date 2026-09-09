import { useRef, useEffect } from 'react'

// Prancheta de assinatura — desenha com o dedo (celular) ou mouse e devolve a
// imagem como data URL PNG via onChange. Mesmo comportamento da assinatura da OS.
//
// O canvas se dimensiona ao espaço real, na resolução do aparelho. Antes era
// fixo em 600×160 esticado por CSS: num Galaxy (~360px de largura) a proporção
// não batia e a assinatura saía achatada e serrilhada — a pessoa assinava e
// via um risco diferente do que fez.
export default function SignaturePad({ titulo, valor, onChange, altura = 140 }) {
  const canvasRef = useRef(null)
  const desenhando = useRef(false)
  const temTraco = useRef(false)

  function estiloTraco(ctx, escala) {
    ctx.scale(escala, escala)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0A0A0A'
  }

  // Ajusta o buffer do canvas ao tamanho em tela × devicePixelRatio, e redesenha
  // o traço que já existia (mudar width/height limpa o canvas).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return

    function ajustar() {
      const largura = c.clientWidth
      const alt = c.clientHeight
      if (!largura || !alt) return
      // teto de 3 para não estourar memória em aparelho com DPR alto
      const escala = Math.min(window.devicePixelRatio || 1, 3)
      const novoW = Math.round(largura * escala)
      const novoH = Math.round(alt * escala)
      if (c.width === novoW && c.height === novoH) return

      const anterior = temTraco.current ? c.toDataURL('image/png') : null
      c.width = novoW
      c.height = novoH
      const ctx = c.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      estiloTraco(ctx, escala)
      if (anterior) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, largura, alt)
        img.src = anterior
      }
    }

    ajustar()
    // Girar o aparelho ou abrir o teclado muda a largura disponível.
    const observador = new ResizeObserver(ajustar)
    observador.observe(c)
    return () => observador.disconnect()
  }, [])

  // Coordenadas em unidades CSS: o contexto já está escalado pelo DPR.
  function ponto(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function iniciar(e) {
    e.preventDefault()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    desenhando.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = ponto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  function mover(e) {
    if (!desenhando.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = ponto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    temTraco.current = true
  }
  function terminar() {
    if (!desenhando.current) return
    desenhando.current = false
    if (temTraco.current) onChange(canvasRef.current.toDataURL('image/png'))
  }
  function limpar() {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    // clearRect anda em unidades CSS (o contexto está escalado)
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight)
    temTraco.current = false
    onChange('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {titulo && <label className="block text-sm font-medium text-gray-700">{titulo}</label>}
        {valor && (
          <button
            type="button"
            onClick={limpar}
            className="text-xs text-brand-red font-medium px-3 min-h-[44px] -my-2"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full block touch-none"
          // No celular a área precisa ser generosa: assinar num campo baixo sai
          // apertado e a pessoa refaz várias vezes.
          style={{ height: `${altura}px`, minHeight: '120px' }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Assine com o dedo (celular) ou o mouse.</p>
    </div>
  )
}
