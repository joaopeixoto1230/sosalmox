import { useState } from 'react'
import { escanearRomaneio, casarMaterial } from '../../utils/scanRomaneio'
import { materialPorQuantidade } from '../../utils/formatters'
import { comprimirParaDataUrl } from '../../utils/imagem'
import NovoMaterialModal from '../estoque/NovoMaterialModal'
import FotoPickerBotoes from '../ui/FotoPickerBotoes'

// Le a foto do romaneio manuscrito, casa cada linha com o estoque e mostra uma tela
// de CONFERENCIA. Nada e lancado sozinho: o colaborador confirma linha a linha e, para
// o que ainda nao existe no sistema, cadastra na hora (NovoMaterialModal pre-preenchido).
// Os itens confirmados sao empurrados para a saida via onAdicionar.

const CONFIANCA_COR = {
  alta: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-700',
  baixa: 'bg-orange-100 text-orange-700',
}

export default function ScanPapelModal({ materiais, itensSelecionados, onAdicionar, onFechar }) {
  const [fase, setFase] = useState('upload') // upload | lendo | revisao
  const [erro, setErro] = useState('')
  const [fotos, setFotos] = useState([]) // [{ id, base64, mediaType, dataUrl }]
  const [linhas, setLinhas] = useState([])
  const [extras, setExtras] = useState([]) // materiais cadastrados agora nesta sessao
  const [cadastroLinha, setCadastroLinha] = useState(null) // indice da linha em cadastro

  const materiaisTodos = [...materiais, ...extras]
  const jaSelecionado = id => itensSelecionados.some(i => i.id === id)

  const [preparando, setPreparando] = useState(false)

  async function aoEscolherFoto(arquivos) {
    if (!arquivos?.length) return
    setErro('')
    setPreparando(true)
    try {
      // Comprime/redimensiona cada foto antes de enviar: foto de celular (3-12 MB) vira
      // ~200 KB com o maior lado em ~1568px (o que a API usa internamente), o que acelera
      // MUITO o upload e a leitura. Tambem re-encoda para JPEG, resolvendo HEIC de iPhone.
      const novas = []
      for (const file of arquivos) {
        const dataUrl = await comprimirParaDataUrl(file, 900000, 1568)
        novas.push({
          id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
          base64: dataUrl.split(',')[1] || '',
          mediaType: 'image/jpeg',
          dataUrl,
        })
      }
      setFotos(prev => [...prev, ...novas])
    } catch (err) {
      setErro(err.message || 'Não foi possível preparar a imagem.')
    } finally {
      setPreparando(false)
    }
  }

  function removerFoto(id) {
    setFotos(prev => prev.filter(f => f.id !== id))
  }

  async function lerPapel() {
    if (fotos.length === 0) return
    setFase('lendo')
    setErro('')
    try {
      const itens = await escanearRomaneio(fotos.map(f => ({ base64: f.base64, mediaType: f.mediaType })))
      if (itens.length === 0) {
        setErro('Nenhum material foi identificado nas fotos. Tente fotos mais nítidas e retas.')
        setFase('upload')
        return
      }
      setLinhas(itens.map((item, idx) => {
        const casado = casarMaterial(item, materiais)
        return {
          id: idx,
          item,
          materialId: casado?.material.id || null,
          incluir: true,
          quantidade: item.quantidade || 1,
        }
      }))
      setFase('revisao')
    } catch (err) {
      setErro(err.message)
      setFase('upload')
    }
  }

  function atualizarLinha(id, patch) {
    setLinhas(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  function aoCadastrarMaterial(novo) {
    setExtras(prev => [...prev, novo])
    if (cadastroLinha != null) {
      atualizarLinha(cadastroLinha, { materialId: novo.id, incluir: true })
    }
    setCadastroLinha(null)
  }

  function confirmar() {
    linhas.forEach(l => {
      if (!l.incluir || !l.materialId) return
      if (jaSelecionado(l.materialId)) return
      const material = materiaisTodos.find(m => m.id === l.materialId)
      if (material) onAdicionar(material, l.quantidade)
    })
    onFechar()
  }

  const prontosParaAdicionar = linhas.filter(
    l => l.incluir && l.materialId && !jaSelecionado(l.materialId)
  ).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Escanear do papel</h2>
            <p className="text-xs text-gray-500">Uma ou mais fotos do romaneio anotado à mão</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* --- Passo 1: escolher a foto --- */}
          {fase === 'upload' && (
            <div className="space-y-4">
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, idx) => (
                    <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={f.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-black/55 text-white px-1.5 py-0.5 rounded">{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removerFoto(f.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-brand-red text-white rounded-full flex items-center justify-center transition-colors"
                        aria-label="Remover foto"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fotos.length === 0 && !preparando && (
                <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-500">
                  <svg className="w-10 h-10 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium">Foto do romaneio anotado à mão</span>
                  <span className="text-xs text-gray-400">Pode adicionar mais de uma foto</span>
                </div>
              )}

              {preparando && (
                <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                  <div className="w-6 h-6 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Preparando imagem…</span>
                </div>
              )}

              {/* Dois botoes: camera e galeria. Garante as duas opcoes em qualquer
                  aparelho (Motorola/Android costumava abrir so o Google Fotos num
                  input sem capture). Ver FotoPickerBotoes. */}
              <FotoPickerBotoes onArquivos={aoEscolherFoto} disabled={preparando} />

              {erro && <p className="text-sm text-brand-red">{erro}</p>}

              {fotos.length > 0 && (
                <button onClick={lerPapel} disabled={preparando} className="btn-primary w-full justify-center gap-1.5 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Ler papel ({fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'})
                </button>
              )}

              <p className="text-xs text-gray-400 text-center">
                A leitura é feita por IA e pode errar — você confere tudo no próximo passo antes de lançar.
              </p>
            </div>
          )}

          {/* --- Passo 2: lendo --- */}
          {fase === 'lendo' && (
            <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
              <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-medium text-brand-black">Lendo o romaneio…</p>
                <p className="text-sm text-gray-500">Identificando os materiais anotados.</p>
              </div>
            </div>
          )}

          {/* --- Passo 3: conferência --- */}
          {fase === 'revisao' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Confira cada linha. O que não foi encontrado no sistema pode ser cadastrado na hora.
              </p>

              {linhas.map(l => {
                const material = materiaisTodos.find(m => m.id === l.materialId)
                const jaEsta = material && jaSelecionado(material.id)
                const porQtd = material && materialPorQuantidade(material)
                return (
                  <div key={l.id} className={`border rounded-xl p-3 ${l.incluir && !jaEsta ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={l.incluir && !jaEsta}
                        disabled={jaEsta}
                        onChange={e => atualizarLinha(l.id, { incluir: e.target.checked })}
                        className="mt-1 w-4 h-4 accent-brand-red flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-brand-black text-sm">
                            {material ? material.nome : l.item.descricao || 'Item ilegível'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CONFIANCA_COR[l.item.confianca] || CONFIANCA_COR.media}`}>
                            {l.item.confianca}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          Papel: {l.item.quantidade > 1 ? `${l.item.quantidade}× ` : ''}{l.item.descricao}
                          {l.item.bitola ? ` · ${l.item.bitola}` : ''}{l.item.metragem ? ` · ${l.item.metragem}` : ''}
                        </p>

                        <div className="mt-1.5">
                          {jaEsta ? (
                            <span className="text-xs text-gray-500">✓ Já está na saída</span>
                          ) : material ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Encontrado: {material.codigo}
                            </span>
                          ) : (
                            <button
                              onClick={() => setCadastroLinha(l.id)}
                              className="text-xs font-semibold text-brand-red hover:underline inline-flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                              Não encontrado — cadastrar agora
                            </button>
                          )}
                        </div>
                      </div>

                      {porQtd && !jaEsta && (
                        <div className="flex-shrink-0">
                          <label className="text-[10px] text-gray-400 block text-center">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={l.quantidade}
                            onChange={e => atualizarLinha(l.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })}
                            className="input w-16 text-center py-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {fase === 'revisao' && (
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button onClick={() => { setFase('upload') }} className="btn-secondary">
              ← Refazer
            </button>
            <button
              onClick={confirmar}
              disabled={prontosParaAdicionar === 0}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              Adicionar {prontosParaAdicionar} {prontosParaAdicionar === 1 ? 'item' : 'itens'} à saída
            </button>
          </div>
        )}
      </div>

      {cadastroLinha != null && (() => {
        const linha = linhas.find(l => l.id === cadastroLinha)
        const it = linha?.item
        return (
          <NovoMaterialModal
            inicial={it ? {
              nome: it.descricao || '',
              categoria: it.categoria || undefined,
              bitola: it.bitola || '',
              metragem: it.metragem || '',
            } : undefined}
            onFechar={() => setCadastroLinha(null)}
            onSalvo={aoCadastrarMaterial}
          />
        )
      })()}
    </div>
  )
}
