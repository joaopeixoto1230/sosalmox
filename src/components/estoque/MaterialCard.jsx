import { useState } from 'react'
import { db } from '../../firebase/config'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { statusMaterialCor, statusMaterialLabel } from '../../utils/formatters'

const STATUS_OPCOES = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'em_evento', label: 'Em Evento' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'perdido', label: 'Perdido' },
]

export default function MaterialCard({ material }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [alterando, setAlterando] = useState(false)

  const estoqueBaixo = material.estoqueAtual <= material.estoqueMin && material.estoqueMin > 0

  async function trocarStatus(novoStatus) {
    setAlterando(true)
    setMenuAberto(false)
    try {
      await updateDoc(doc(db, 'materiais', material.id), { status: novoStatus })
    } finally {
      setAlterando(false)
    }
  }

  async function excluir() {
    setMenuAberto(false)
    if (!window.confirm(`Excluir "${material.nome}"? Esta ação não pode ser desfeita.`)) return
    await deleteDoc(doc(db, 'materiais', material.id))
  }

  return (
    <div className={`card transition-all hover:shadow-md ${estoqueBaixo ? 'border-red-200' : ''} relative`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-black text-sm leading-tight truncate">{material.nome}</p>
          <p className="text-xs text-brand-red font-mono mt-0.5">{material.codigo}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`badge ${statusMaterialCor(material.status)}`}>
            {statusMaterialLabel(material.status)}
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuAberto(v => !v)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden">
                  <p className="text-xs font-semibold text-gray-400 px-3 py-1.5">Trocar status</p>
                  {STATUS_OPCOES.map(s => (
                    <button key={s.value} onClick={() => trocarStatus(s.value)}
                      disabled={material.status === s.value}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors
                        ${material.status === s.value
                          ? 'text-brand-red font-semibold bg-red-50'
                          : 'text-gray-700 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={excluir}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                      Excluir item
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-0.5 text-xs text-gray-500 mb-3">
        <p>{material.categoria} • {material.tipo}</p>
        {material.bitola && <p>Bitola: <span className="font-medium text-gray-700">{material.bitola}</span></p>}
        {material.metragem && <p>Comprimento: <span className="font-medium text-gray-700">{material.metragem}</span></p>}
        {material.status === 'em_evento' && material.eventoAtual && (
          <p className="text-yellow-600 font-medium truncate">📍 {material.eventoAtual}</p>
        )}
      </div>

      {material.estoqueMin > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${estoqueBaixo ? 'bg-brand-red' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (material.estoqueAtual / material.estoqueMin) * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${estoqueBaixo ? 'text-brand-red' : 'text-gray-500'}`}>
            {material.estoqueAtual}/{material.estoqueMin}
          </span>
          {estoqueBaixo && (
            <span className="text-brand-red" title="Estoque baixo">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
      )}

      {alterando && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
