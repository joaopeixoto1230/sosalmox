import { useRef } from 'react'

// Dois botoes explicitos para adicionar foto: "Tirar foto" (camera, via capture) e
// "Galeria" (sem capture). Isso garante as DUAS opcoes em qualquer aparelho — alguns
// Android (ex: Motorola) abrem direto o Google Fotos num input sem capture, sem
// oferecer a camera; e alguns iOS so mostravam a camera quando havia capture. Com os
// dois botoes, cada um forca um caminho e o usuario escolhe.
//
// onArquivos: recebe um Array<File>. multiple vale so para a galeria (camera = 1 foto).
export default function FotoPickerBotoes({ onArquivos, multiple = true, disabled = false, className = '' }) {
  const camRef = useRef(null)
  const galRef = useRef(null)

  function handle(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (files.length > 0) onArquivos(files)
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={galRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handle} />

      <button
        type="button"
        onClick={() => !disabled && camRef.current?.click()}
        disabled={disabled}
        className="btn-secondary flex-1 justify-center gap-2 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Tirar foto
      </button>

      <button
        type="button"
        onClick={() => !disabled && galRef.current?.click()}
        disabled={disabled}
        className="btn-secondary flex-1 justify-center gap-2 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Galeria
      </button>
    </div>
  )
}
