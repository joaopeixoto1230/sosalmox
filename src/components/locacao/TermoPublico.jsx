import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SignaturePad from '../ui/SignaturePad'
import FotoPickerBotoes from '../ui/FotoPickerBotoes'
import { comprimirParaDataUrl } from '../../utils/imagem'
import { mascaraDocumento } from '../../utils/mascaras'
import { TIPOS_TERMO, pendenciasDoTermo, resumoConferencia } from './termos'

// Página PÚBLICA (sem login) do termo de entrega/devolução da locação.
//
// Quem abre é o cliente (entrega) ou o colaborador que foi recolher o material
// (devolução), pelo link do WhatsApp. Lê e grava em termos_locacao/<token> —
// mesma ideia de capability URL do /assinar/:token, com regra do Firestore que
// só deixa preencher UMA vez e não deixa mexer na lista de itens.

export default function TermoPublico() {
  const { token } = useParams()
  const [estado, setEstado] = useState('carregando') // carregando | ok | pronto | naoencontrado | erro
  const [termo, setTermo] = useState(null)
  const [conferencia, setConferencia] = useState({})
  const [clienteNome, setClienteNome] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [clienteAssinatura, setClienteAssinatura] = useState('')
  const [sosNome, setSosNome] = useState('')
  const [sosAssinatura, setSosAssinatura] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])
  const [progresso, setProgresso] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        const snap = await getDoc(doc(db, 'termos_locacao', token))
        if (!snap.exists()) { setEstado('naoencontrado'); return }
        const d = { id: snap.id, ...snap.data() }
        setTermo(d)
        // ⚠️ Só a ENTREGA reaproveita o nome gravado — ali ele é de quem já
        // entregou, e a tela só exibe. Na devolução o campo abre EM BRANCO:
        // quem recolhe raramente é quem gerou o link, e o nome de outra pessoa
        // esperando no campo é assinado sem ninguém reparar.
        setSosNome(d.tipo === 'entrega' ? (d.sosNome || '') : '')
        if (d.status === 'assinado') { setEstado('pronto'); return }
        setEstado('ok')
      } catch (e) {
        console.error(e)
        setEstado('erro')
      }
    }
    carregar()
  }, [token])

  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.preview)), [fotos])

  const ehDevolucao = termo?.tipo === 'devolucao'
  const rotulos = TIPOS_TERMO[termo?.tipo] || TIPOS_TERMO.entrega
  const itens = useMemo(() => termo?.itens || [], [termo])

  const pendencias = useMemo(() => pendenciasDoTermo(termo?.tipo, {
    itens, conferencia, clienteNome, clienteDocumento, clienteAssinatura, sosAssinatura,
  }), [termo?.tipo, itens, conferencia, clienteNome, clienteDocumento, clienteAssinatura, sosAssinatura])

  const { faltantes } = resumoConferencia(itens, conferencia)

  function adicionarFotos(arquivos) {
    if (!arquivos?.length) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function removerFoto(idx) {
    setFotos(prev => {
      const f = prev[idx]
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function confirmar() {
    if (pendencias.length > 0) {
      setErro(`Ainda falta ${pendencias.join(', ')}.`)
      return
    }
    setSalvando(true)
    setErro('')
    try {
      // As fotos vão primeiro, em documentos próprios (o doc do termo não
      // aguentaria várias imagens dentro do limite de 1 MB do Firestore).
      // Elas ficam ligadas pelo termoId; se a assinatura falhar depois, o
      // termo continua pendente e uma nova tentativa só reenvia o que faltar.
      for (let i = 0; i < fotos.length; i++) {
        setProgresso({ atual: i + 1, total: fotos.length })
        const dataUrl = await comprimirParaDataUrl(fotos[i].file)
        await addDoc(collection(db, 'fotos_termo'), {
          termoId: token,
          ordem: i,
          dataUrl,
          criadoEm: serverTimestamp(),
        })
      }
      setProgresso(null)

      await updateDoc(doc(db, 'termos_locacao', token), {
        clienteNome: clienteNome.trim(),
        clienteDocumento: clienteDocumento.trim(),
        clienteAssinatura,
        ...(ehDevolucao ? {
          sosNome: sosNome.trim() || termo.sosNome || null,
          sosAssinatura,
          conferencia,
          faltantes: faltantes.map(i => ({ nome: i.nome || null, codigo: i.codigo || null })),
        } : {}),
        observacoes: observacoes.trim() || null,
        qtdFotos: fotos.length,
        status: 'assinado',
        assinadoEm: serverTimestamp(),
      })
      setEstado('pronto')
    } catch (e) {
      console.error(e)
      setProgresso(null)
      setErro('Não foi possível salvar. Verifique a conexão e tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-brand-bg flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <img src="/logo-sos-v2.png" alt="SOS Energia" className="h-10 object-contain" />
        </div>

        {estado === 'carregando' && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {estado === 'naoencontrado' && (
          <div className="card text-center py-10">
            <p className="font-bold text-brand-black">Link inválido</p>
            <p className="text-sm text-gray-500 mt-1">Este termo não existe ou foi cancelado.</p>
          </div>
        )}

        {estado === 'erro' && (
          <div className="card text-center py-10">
            <p className="font-bold text-brand-black">Erro ao carregar</p>
            <p className="text-sm text-gray-500 mt-1">Verifique sua conexão e recarregue a página.</p>
          </div>
        )}

        {estado === 'pronto' && (
          <div className="card text-center py-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-bold text-brand-black">Termo assinado!</p>
            <p className="text-sm text-gray-500 mt-1">
              {ehDevolucao
                ? 'A devolução foi registrada. O almoxarifado já consegue emitir o documento.'
                : 'O recebimento foi registrado. Uma via será enviada pelo almoxarifado.'}
            </p>
          </div>
        )}

        {estado === 'ok' && termo && (
          <div className="space-y-4">
            <div className="card">
              <h1 className="font-bold text-brand-black">{rotulos.titulo} de Material</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {ehDevolucao
                  ? 'Confira item a item o que está voltando e colha a assinatura de quem está devolvendo.'
                  : 'Confira a lista do material recebido e assine para confirmar.'}
              </p>

              <div className="mt-3 space-y-1.5 text-sm">
                {termo.eventoNome && <p><span className="text-gray-400">Cliente:</span> <span className="font-medium text-brand-black">{termo.eventoNome}</span></p>}
                {termo.local && <p><span className="text-gray-400">Local:</span> <span className="font-medium text-brand-black">{termo.local}</span></p>}
                {termo.numeroFormatado && <p><span className="text-gray-400">Ordem:</span> <span className="font-medium text-brand-red">{termo.numeroFormatado}</span></p>}
                {!ehDevolucao && termo.sosNome && (
                  <p><span className="text-gray-400">Entregue por:</span> <span className="font-medium text-brand-black">{termo.sosNome}</span></p>
                )}
              </div>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {ehDevolucao ? `Conferência (${itens.length + (termo.geradores?.length || 0)})` : `Material (${itens.length + (termo.geradores?.length || 0)})`}
              </p>

              {termo.geradores?.length > 0 && (
                <div className="space-y-1 mb-3">
                  {termo.geradores.map(g => (
                    <div key={g.codigo} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <span className="font-medium">Gerador {g.codigo}</span>
                    </div>
                  ))}
                </div>
              )}

              {ehDevolucao ? (
                <ul className="space-y-2">
                  {itens.map(item => {
                    const resposta = conferencia[item.chave]
                    return (
                      <li key={item.chave} className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-medium text-brand-black leading-snug">{item.nome}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {item.codigo}{item.quantidade > 1 ? ` · ${item.quantidade} un.` : ''}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            onClick={() => setConferencia(p => ({ ...p, [item.chave]: 'ok' }))}
                            className={`min-h-[44px] rounded-lg text-sm font-semibold border-2 transition-colors ${
                              resposta === 'ok'
                                ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/40'
                                : 'border-gray-200 text-gray-500 dark:border-gray-700'}`}
                          >
                            Voltou
                          </button>
                          <button
                            onClick={() => setConferencia(p => ({ ...p, [item.chave]: 'faltou' }))}
                            className={`min-h-[44px] rounded-lg text-sm font-semibold border-2 transition-colors ${
                              resposta === 'faltou'
                                ? 'border-brand-red bg-red-50 text-brand-red dark:bg-red-950/40'
                                : 'border-gray-200 text-gray-500 dark:border-gray-700'}`}
                          >
                            Faltou
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="space-y-1">
                  {itens.map(item => (
                    <div key={item.chave} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <span className="truncate">{item.nome}</span>
                      {item.quantidade > 1 && (
                        <span className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-semibold px-1.5 py-0.5 rounded">
                          {item.quantidade} un.
                        </span>
                      )}
                      <span className="text-gray-400 font-mono text-xs flex-shrink-0">{item.codigo}</span>
                    </div>
                  ))}
                </div>
              )}

              {ehDevolucao && faltantes.length > 0 && (
                <p className="mt-3 text-xs rounded-xl px-3 py-2 border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {faltantes.length} {faltantes.length === 1 ? 'item marcado como faltante' : 'itens marcados como faltantes'}.
                  Isso vai constar no termo assinado pelos dois lados.
                </p>
              )}
            </div>

            {ehDevolucao && (
              <div className="card space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Fotos (opcional)</p>
                  <p className="text-xs text-gray-400 mb-2">
                    Vale a pena fotografar o que faltou e o estado do material.
                  </p>
                  <FotoPickerBotoes onArquivos={adicionarFotos} disabled={salvando} />
                </div>
                {fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map((f, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={f.preview} alt="Foto" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removerFoto(i)}
                          className="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Observações</label>
                  <textarea
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    rows={3}
                    placeholder="Ex: cabo 4x50 não foi localizado no local, cliente vai procurar."
                    className="input"
                  />
                </div>
              </div>
            )}

            <div className="card space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {ehDevolucao ? 'Quem está devolvendo o material' : 'Quem está recebendo o material'}
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome (cliente) *</label>
                <input
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                  placeholder="Nome completo"
                  className="input"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{rotulos.docLabel} *</label>
                <input
                  value={clienteDocumento}
                  onChange={e => setClienteDocumento(mascaraDocumento(e.target.value))}
                  placeholder={ehDevolucao ? '12.345.678-9' : '123.456.789-00'}
                  inputMode="numeric"
                  className="input"
                />
              </div>
              <SignaturePad titulo="Assinatura *" valor={clienteAssinatura} onChange={setClienteAssinatura} altura={160} />
            </div>

            {ehDevolucao && (
              <div className="card space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Quem está recolhendo pela SOS
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nome *</label>
                  <input
                    value={sosNome}
                    onChange={e => setSosNome(e.target.value)}
                    placeholder="Seu nome"
                    className="input"
                  />
                </div>
                <SignaturePad titulo="Assinatura *" valor={sosAssinatura} onChange={setSosAssinatura} altura={160} />
              </div>
            )}

            <div className="card space-y-2">
              {progresso && (
                <p className="text-sm text-gray-500">Enviando foto {progresso.atual} de {progresso.total}...</p>
              )}
              {erro && <p className="text-sm text-brand-red">{erro}</p>}
              {pendencias.length > 0 && !erro && (
                <p className="text-xs text-gray-400">Falta {pendencias.join(', ')}.</p>
              )}
              <button
                onClick={confirmar}
                disabled={salvando || pendencias.length > 0}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : rotulos.acao}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">SOS Energia — Almoxarifado</p>
      </div>
    </div>
  )
}
