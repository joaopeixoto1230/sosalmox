import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, storage } from '../../firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { statusGeradorLabel, statusGeradorCor, formatarData } from '../../utils/formatters'

const STATUS_OPCOES = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'em_evento', label: 'Em Evento' },
  { value: 'manutencao', label: 'Em Manutenção' },
  { value: 'defeito', label: 'Com Defeito' },
]

export default function GGCard({ gg }) {
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const [subMenu, setSubMenu] = useState(null)
  const [editLocal, setEditLocal] = useState(gg.localizacao || '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const diasParado = gg.ultimaAtividade ? (() => {
    const d = gg.ultimaAtividade?.toDate ? gg.ultimaAtividade.toDate() : new Date(gg.ultimaAtividade)
    return Math.floor((Date.now() - d.getTime()) / 86400000)
  })() : null

  const alertaParado = diasParado !== null && diasParado >= 15 && gg.status === 'disponivel'
  const alertaDefeito = gg.temDefeito && gg.status !== 'em_evento'

  function fecharMenu() {
    setMenuAberto(false)
    setSubMenu(null)
  }

  async function trocarStatus(novoStatus) {
    fecharMenu()
    await updateDoc(doc(db, 'geradores', gg.id), { status: novoStatus })
  }

  async function salvarLocal() {
    await updateDoc(doc(db, 'geradores', gg.id), { localizacao: editLocal })
    fecharMenu()
  }

  async function handleFotoSelecionada(e) {
    const file = e.target.files?.[0]
    if (!file) return
    fecharMenu()
    setUploading(true)
    try {
      const storageRef = ref(storage, `geradores/${gg.id}/foto`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'geradores', gg.id), { fotoUrl: url })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`card transition-all hover:shadow-md relative ${alertaDefeito ? 'border-red-300' : alertaParado ? 'border-yellow-300' : ''}`}>
      {gg.fotoUrl && (
        <div className="-mx-4 -mt-4 mb-3 rounded-t-xl overflow-hidden h-28">
          <img src={gg.fotoUrl} alt={gg.codigo} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/geradores/${gg.id}`)}
        >
          <p className="font-bold text-brand-black">{gg.codigo}</p>
          <p className="text-xs text-gray-500">
            {gg.potencia}{gg.potencia ? ' • ' : ''}{gg.marca || ''}{gg.modelo ? ` ${gg.modelo}` : ''}
          </p>
          {gg.motor && (
            <p className="text-xs text-gray-400 mt-0.5">{gg.motor}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`badge ${statusGeradorCor(gg.status)}`}>
            {statusGeradorLabel(gg.status)}
          </span>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuAberto(v => !v); setSubMenu(null) }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>

            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={fecharMenu} />
                <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-1 overflow-hidden">
                  <button
                    onClick={() => setSubMenu(subMenu === 'status' ? null : 'status')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    Trocar status
                    <svg className={`w-3.5 h-3.5 transition-transform ${subMenu === 'status' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {subMenu === 'status' && (
                    <div className="bg-gray-50 border-t border-b border-gray-100">
                      {STATUS_OPCOES.map(s => (
                        <button
                          key={s.value}
                          onClick={() => trocarStatus(s.value)}
                          disabled={gg.status === s.value}
                          className={`w-full text-left px-5 py-1.5 text-sm transition-colors
                            ${gg.status === s.value
                              ? 'text-brand-red font-semibold bg-red-50'
                              : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { setSubMenu(subMenu === 'local' ? null : 'local'); setEditLocal(gg.localizacao || '') }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    Atualizar localização
                    <svg className={`w-3.5 h-3.5 transition-transform ${subMenu === 'local' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {subMenu === 'local' && (
                    <div className="bg-gray-50 border-t border-b border-gray-100 px-3 py-2 space-y-2">
                      <input
                        className="input text-sm w-full"
                        value={editLocal}
                        onChange={e => setEditLocal(e.target.value)}
                        placeholder="Localização"
                        autoFocus
                      />
                      <button onClick={salvarLocal} className="btn-primary text-xs w-full py-1.5">
                        Salvar
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => { fecharMenu(); fileInputRef.current?.click() }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Adicionar foto
                  </button>

                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { fecharMenu(); navigate(`/geradores/${gg.id}`) }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="cursor-pointer"
        onClick={() => navigate(`/geradores/${gg.id}`)}
      >
        <p className="text-xs text-gray-600 truncate">{gg.localizacao || 'Pátio SOS'}</p>

        {gg.horimetroAtual > 0 && (
          <p className="text-xs text-gray-400 mt-1">{gg.horimetroAtual?.toLocaleString('pt-BR')}h</p>
        )}

        {(alertaParado || alertaDefeito) && (
          <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-lg ${alertaDefeito ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}`}>
            {alertaDefeito ? `⚠️ ${gg.defeito || 'Com defeito'}` : `⏱️ Parado há ${diasParado} dias`}
          </div>
        )}

        {gg.proximaPreventiva && (
          <p className="text-xs text-gray-400 mt-1.5">Preventiva: {formatarData(gg.proximaPreventiva)}</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoSelecionada}
      />

      {uploading && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center z-30">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
