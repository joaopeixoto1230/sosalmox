import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { statusGeradorLabel, statusGeradorCor, formatarData, statusEfetivoCaminhao, caminhaoAcompanhaGerador } from '../../utils/formatters'

// Carrega uma imagem (File) num elemento <img> — funciona em qualquer celular.
function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler a imagem')) }
    img.src = url
  })
}

// Comprime a foto e devolve um data URL (JPEG base64) para guardar no Firestore.
// O projeto é Spark (sem Storage), então a foto vai como base64 no doc do caminhão.
// Fotos de celular de 5–12 MB viram ~80–250 KB, abaixo do limite de 1 MB do Firestore.
async function comprimirParaDataUrl(file, maxBytes = 650000) {
  if (!file?.type?.startsWith('image/')) throw new Error('O arquivo selecionado não é uma imagem.')
  const img = await carregarImagem(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let maxLado = 1280
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
  return dataUrl
}

const STATUS_OPCOES = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'em_evento', label: 'Em Evento' },
  { value: 'locacao', label: 'Em Locação' },
  { value: 'manutencao', label: 'Em Manutenção' },
  { value: 'defeito', label: 'Com Defeito' },
]

export default function CaminhaoCard({ caminhao, gerador }) {
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const [subMenu, setSubMenu] = useState(null)
  const [editLocal, setEditLocal] = useState(caminhao.localizacao || '')
  const [motivoDefeito, setMotivoDefeito] = useState('')
  const [localLocacao, setLocalLocacao] = useState('')
  const [editObs, setEditObs] = useState(caminhao.observacao || '')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fotoMenu, setFotoMenu] = useState(false)
  const [fotoAberta, setFotoAberta] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const diasParado = caminhao.ultimaAtividade ? (() => {
    const d = caminhao.ultimaAtividade?.toDate ? caminhao.ultimaAtividade.toDate() : new Date(caminhao.ultimaAtividade)
    return Math.floor((Date.now() - d.getTime()) / 86400000)
  })() : null

  // Status exibido: se houver gerador montado e ele estiver em evento/locacao,
  // o caminhao acompanha (vai junto). Defeito/manutencao do gerador NAO mudam o
  // caminhao; condicoes do proprio caminhao prevalecem.
  const statusEfetivo = statusEfetivoCaminhao(caminhao, gerador)
  const acompanha = caminhaoAcompanhaGerador(caminhao, gerador)
  const defeitoTexto = caminhao.defeito || ''

  const alertaParado = diasParado !== null && diasParado >= 15 && statusEfetivo === 'disponivel'
  const alertaDefeito = statusEfetivo === 'defeito'

  function fecharMenu() {
    setMenuAberto(false)
    setSubMenu(null)
  }

  async function trocarStatus(novoStatus) {
    if (novoStatus === 'defeito') {
      setSubMenu('defeito')
      setMotivoDefeito('')
      return
    }
    if (novoStatus === 'locacao') {
      setSubMenu('locacao')
      setLocalLocacao(caminhao.localizacao && caminhao.status === 'locacao' ? caminhao.localizacao : '')
      return
    }
    fecharMenu()
    const dados = {
      status: novoStatus,
      temDefeito: false,
      defeito: '',
    }
    if (novoStatus === 'disponivel') {
      dados.localizacao = 'Pátio SOS'
      dados.eventoAtual = null
      dados.eventoNome = null
    }
    await updateDoc(doc(db, 'caminhoes', caminhao.id), dados)
  }

  async function confirmarDefeito() {
    fecharMenu()
    await updateDoc(doc(db, 'caminhoes', caminhao.id), {
      status: 'defeito',
      temDefeito: true,
      defeito: motivoDefeito.trim() || 'Com defeito',
    })
  }

  async function confirmarLocacao() {
    fecharMenu()
    await updateDoc(doc(db, 'caminhoes', caminhao.id), {
      status: 'locacao',
      localizacao: localLocacao.trim() || 'Locação externa',
      temDefeito: false,
      defeito: '',
    })
  }

  async function salvarLocal() {
    await updateDoc(doc(db, 'caminhoes', caminhao.id), { localizacao: editLocal })
    fecharMenu()
  }

  async function salvarObs() {
    setSalvandoObs(true)
    try {
      await updateDoc(doc(db, 'caminhoes', caminhao.id), { observacao: editObs.trim() })
      fecharMenu()
    } finally {
      setSalvandoObs(false)
    }
  }

  async function handleFotoSelecionada(e) {
    const file = e.target.files?.[0]
    if (!file) return
    fecharMenu()
    setUploading(true)
    try {
      const dataUrl = await comprimirParaDataUrl(file)
      await updateDoc(doc(db, 'caminhoes', caminhao.id), { fotoUrl: dataUrl })
    } catch (err) {
      alert(err?.message || 'Não foi possível adicionar a foto. Tente novamente.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  async function excluirFoto() {
    setFotoMenu(false)
    if (!window.confirm('Excluir a foto deste caminhão?')) return
    setUploading(true)
    try {
      await updateDoc(doc(db, 'caminhoes', caminhao.id), { fotoUrl: null })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`card transition-all hover:shadow-md relative ${alertaDefeito ? 'border-red-300' : alertaParado ? 'border-yellow-300' : ''}`}>
      {caminhao.fotoUrl && (
        <div className="-mx-4 -mt-4 mb-3 h-28 relative">
          <div className="rounded-t-xl overflow-hidden h-full">
            <img
              src={caminhao.fotoUrl}
              alt={caminhao.placa}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setFotoAberta(true)}
            />
          </div>
          <div className="absolute top-1.5 right-1.5 z-30">
            <button
              onClick={(e) => { e.stopPropagation(); setFotoMenu(v => !v) }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/45 text-white hover:bg-black/65 transition-colors backdrop-blur-sm"
              title="Editar foto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {fotoMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFotoMenu(false)} />
                <div className="absolute right-0 top-8 z-40 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden">
                  <button
                    onClick={() => { setFotoMenu(false); cameraInputRef.current?.click() }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    📷 Tirar outra foto
                  </button>
                  <button
                    onClick={() => { setFotoMenu(false); fileInputRef.current?.click() }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    🖼️ Trocar foto (galeria)
                  </button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={excluirFoto}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      🗑️ Excluir foto
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/caminhoes/${caminhao.id}`)}
        >
          <p className="font-bold text-brand-black tracking-wide">{caminhao.placa}</p>
          {caminhao.observacao && (
            <p className="text-xs font-medium text-gray-600 mt-0.5 leading-snug">{caminhao.observacao}</p>
          )}
          {(caminhao.marca || caminhao.modelo || caminhao.ano) && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {[caminhao.marca, caminhao.modelo].filter(Boolean).join(' ')}{caminhao.ano ? ` • ${caminhao.ano}` : ''}
            </p>
          )}
          {gerador && (
            <p className="text-[11px] text-brand-red font-medium mt-0.5">⚡ Acompanha {gerador.codigo}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`badge ${statusGeradorCor(statusEfetivo)}`}>
            {statusGeradorLabel(statusEfetivo)}
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
                          disabled={caminhao.status === s.value}
                          className={`w-full text-left px-5 py-1.5 text-sm transition-colors
                            ${caminhao.status === s.value
                              ? 'text-brand-red font-semibold bg-red-50'
                              : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {subMenu === 'defeito' && (
                    <div className="bg-red-50 border-t border-b border-red-100 px-3 py-2 space-y-2">
                      <p className="text-xs font-medium text-red-700">Qual o defeito?</p>
                      <input
                        className="input text-sm w-full"
                        value={motivoDefeito}
                        onChange={e => setMotivoDefeito(e.target.value)}
                        placeholder="Ex: Pneu furado, freio..."
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && confirmarDefeito()}
                      />
                      <button onClick={confirmarDefeito} className="btn-primary text-xs w-full py-1.5 bg-red-600 hover:bg-red-700">
                        Confirmar defeito
                      </button>
                    </div>
                  )}
                  {subMenu === 'locacao' && (
                    <div className="bg-purple-50 border-t border-b border-purple-100 px-3 py-2 space-y-2">
                      <p className="text-xs font-medium text-purple-700">Onde está em locação?</p>
                      <input
                        className="input text-sm w-full"
                        value={localLocacao}
                        onChange={e => setLocalLocacao(e.target.value)}
                        placeholder="Ex: Cliente XPTO · Goiânia"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && confirmarLocacao()}
                      />
                      <button onClick={confirmarLocacao} className="btn-primary text-xs w-full py-1.5 bg-purple-600 hover:bg-purple-700">
                        Confirmar locação
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => { setSubMenu(subMenu === 'local' ? null : 'local'); setEditLocal(caminhao.localizacao || '') }}
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
                    onClick={() => { setSubMenu(subMenu === 'obs' ? null : 'obs'); setEditObs(caminhao.observacao || '') }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    {caminhao.observacao ? 'Editar observação' : 'Adicionar observação'}
                    <svg className={`w-3.5 h-3.5 transition-transform ${subMenu === 'obs' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {subMenu === 'obs' && (
                    <div className="bg-amber-50 border-t border-b border-amber-100 px-3 py-2 space-y-2">
                      <p className="text-xs font-medium text-amber-700">Observação do caminhão</p>
                      <textarea
                        className="input text-sm w-full resize-none"
                        rows={3}
                        value={editObs}
                        onChange={e => setEditObs(e.target.value)}
                        placeholder="Ex: Ar condicionado com defeito, documento vence em..."
                        autoFocus
                      />
                      <button onClick={salvarObs} disabled={salvandoObs} className="btn-primary text-xs w-full py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60">
                        {salvandoObs ? 'Salvando...' : 'Salvar observação'}
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
                      onClick={() => { fecharMenu(); navigate(`/caminhoes/${caminhao.id}`) }}
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
        onClick={() => navigate(`/caminhoes/${caminhao.id}`)}
      >
        <p className="text-xs text-gray-600 truncate">
          {(acompanha ? (gerador.localizacao || gerador.eventoNome) : caminhao.localizacao) || 'Pátio SOS'}
        </p>

        {caminhao.horimetroAtual > 0 && (
          <p className="text-xs text-gray-400 mt-1">{caminhao.horimetroAtual?.toLocaleString('pt-BR')}h</p>
        )}

        {(alertaParado || alertaDefeito) && (
          <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-lg ${alertaDefeito ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}`}>
            {alertaDefeito ? `⚠️ ${defeitoTexto || 'Com defeito'}` : `⏱️ Parado há ${diasParado} dias`}
          </div>
        )}

        {caminhao.proximaPreventiva && (
          <p className="text-xs text-gray-400 mt-1.5">Preventiva: {formatarData(caminhao.proximaPreventiva)}</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoSelecionada}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoSelecionada}
      />

      {uploading && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center z-30">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {fotoAberta && caminhao.fotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setFotoAberta(false)}
        >
          <button
            onClick={() => setFotoAberta(false)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors text-2xl leading-none"
            title="Fechar"
          >
            ×
          </button>
          <div className="flex flex-col items-center max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={caminhao.fotoUrl}
              alt={caminhao.placa}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="mt-3 text-white text-sm font-medium">
              {caminhao.placa}{caminhao.marca ? ` • ${caminhao.marca}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
