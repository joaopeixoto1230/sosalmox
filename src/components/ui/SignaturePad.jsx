import { useRef, useEffect } from 'react'

// Prancheta de assinatura — desenha com o dedo (celular) ou mouse e devolve a
// imagem como data URL PNG via onChange. Mesmo comportamento da assinatura da OS.
export default function SignaturePad({ titulo, valor, onChange, altura = 140 }) {
  const canvasRef = useRef(null)
  const desenhando = useRef(false)
  const temTraco = useRef(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0A0A0A'
  }, [])

  function ponto(e) {
    const c = canvasRef.current
    const rect = c.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    }
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
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    temTraco.current = false
    onChange('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {titulo && <label className="block text-sm font-medium text-gray-700">{titulo}</label>}
        {valor && <button type="button" onClick={limpar} className="text-xs text-brand-red font-medium">Limpar</button>}
      </div>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full block touch-none"
          style={{ height: `${altura}px` }}
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
