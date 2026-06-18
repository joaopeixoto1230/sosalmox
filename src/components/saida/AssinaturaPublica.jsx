import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SignaturePad from '../ui/SignaturePad'

// Pagina publica (sem login) para o recebedor do material assinar a OS via link.
// Le e grava no documento assinaturas_saida/<token> (capability URL).
export default function AssinaturaPublica() {
  const { token } = useParams()
  const [estado, setEstado] = useState('carregando') // carregando | ok | assinada | naoencontrado | erro
  const [dados, setDados] = useState(null)
  const [assinatura, setAssinatura] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        const snap = await getDoc(doc(db, 'assinaturas_saida', token))
        if (!snap.exists()) { setEstado('naoencontrado'); return }
        const d = snap.data()
        setDados(d)
        if (d.recebeuAssinatura) { setEstado('assinada'); return }
        setEstado('ok')
      } catch (e) {
        console.error(e)
        setEstado('erro')
      }
    }
    carregar()
  }, [token])

  async function confirmar() {
    if (!assinatura) { setErro('Assine no campo acima.'); return }
    setSalvando(true); setErro('')
    try {
      await updateDoc(doc(db, 'assinaturas_saida', token), {
        recebeuAssinatura: assinatura,
        status: 'assinada',
        assinadoEm: serverTimestamp(),
      })
      setEstado('assinada')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar a assinatura. Verifique a conexão e tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center px-4 py-8">
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
            <p className="text-sm text-gray-500 mt-1">Este link de assinatura não existe ou expirou.</p>
          </div>
        )}

        {estado === 'erro' && (
          <div className="card text-center py-10">
            <p className="font-bold text-brand-black">Erro ao carregar</p>
            <p className="text-sm text-gray-500 mt-1">Verifique sua conexão e recarregue a página.</p>
          </div>
        )}

        {estado === 'assinada' && (
          <div className="card text-center py-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-bold text-brand-black">Assinatura registrada!</p>
            <p className="text-sm text-gray-500 mt-1">Obrigado. O recebimento do material foi confirmado.</p>
          </div>
        )}

        {estado === 'ok' && dados && (
          <div className="space-y-4">
            <div className="card">
              <h1 className="font-bold text-brand-black">Confirmação de recebimento</h1>
              <p className="text-sm text-gray-500 mt-0.5">Confira os dados e assine para confirmar.</p>

              <div className="mt-3 space-y-1.5 text-sm">
                {dados.numeroFormatado && (
                  <p className="font-bold text-brand-red">{dados.numeroFormatado}</p>
                )}
                {dados.eventoNome && <p><span className="text-gray-400">Evento:</span> <span className="font-medium text-brand-black">{dados.eventoNome}</span></p>}
                {dados.local && <p><span className="text-gray-400">Local:</span> <span className="font-medium text-brand-black">{dados.local}</span></p>}
                {dados.entregouNome && <p><span className="text-gray-400">Entregue por:</span> <span className="font-medium text-brand-black">{dados.entregouNome}</span></p>}
              </div>

              {dados.itens?.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Materiais ({dados.itens.length})</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {dados.itens.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <span className="truncate">{it.nome}</span>
                        {it.quantidade > 0 && <span className="flex-shrink-0 bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">{it.quantidade} un.</span>}
                        <span className="text-gray-400 font-mono flex-shrink-0">{it.codigo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Você está assinando como</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <p className="font-bold text-brand-black">{dados.recebeuNome || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Confira se o nome está correto. Em caso de divergência, fale com o almoxarifado.</p>
                </div>
              </div>
              <SignaturePad titulo="Assinatura *" valor={assinatura} onChange={setAssinatura} />
              {erro && <p className="text-sm text-brand-red">{erro}</p>}
              <button onClick={confirmar} disabled={salvando} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Confirmar recebimento'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">SOS Energia — Almoxarifado</p>
      </div>
    </div>
  )
}
