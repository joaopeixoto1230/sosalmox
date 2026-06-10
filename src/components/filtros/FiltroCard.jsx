import { useState } from 'react'
import { db } from '../../firebase/config'
import { doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { statusFiltroLabel, statusFiltroCor, formatarData } from '../../utils/formatters'

export default function FiltroCard({ filtro, onEntrada, onBaixa }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [ajustando, setAjustando] = useState(false)
  const [valorAjuste, setValorAjuste] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  const { quantidadeAtual = 0, estoqueMin = 0, validade } = filtro
  const pct = estoqueMin > 0 ? Math.min(100, (quantidadeAtual / estoqueMin) * 100) : 100
  const critico = quantidadeAtual <= 0
  const baixo = !critico && quantidadeAtual <= estoqueMin

  const hoje = new Date()
  const dataVal = validade?.toDate ? validade.toDate() : validade ? new Date(validade) : null
  const diasVal = dataVal ? Math.ceil((dataVal - hoje) / 86400000) : null
  const vencendo = diasVal !== null && diasVal <= 30 && diasVal > 0
  const vencido = diasVal !== null && diasVal <= 0

  async function excluir() {
    setMenuAberto(false)
    if (!window.confirm(`Excluir "${filtro.nome}"? Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    try {
      await deleteDoc(doc(db, 'filtros', filtro.id))
    } finally {
      setExcluindo(false)
    }
  }

  function abrirAjuste() {
    setMenuAberto(false)
    setValorAjuste(String(quantidadeAtual))
    setAjustando(true)
  }

  async function salvarAjuste() {
    const nova = parseInt(valorAjuste)
    if (isNaN(nova) || nova < 0) return
    setSalvandoAjuste(true)
    try {
      await updateDoc(doc(db, 'filtros', filtro.id), { quantidadeAtual: nova })
      setAjustando(false)
    } finally {
      setSalvandoAjuste(false)
    }
  }

  return (
    <div className={`card border-l-4 ${critico ? 'border-red-500' : baixo ? 'border-yellow-500' : 'border-green-500'} relative`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-black text-sm leading-tight">{filtro.nome}</p>
          {filtro.referencia && (
            <p className="text-xs text-brand-red font-mono mt-0.5">{filtro.referencia}</p>
          )}
          {filtro.fornecedor && (
            <p className="text-xs text-gray-400">{filtro.fornecedor}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`badge ${statusFiltroCor(quantidadeAtual, estoqueMin)}`}>
            {statusFiltroLabel(quantidadeAtual, estoqueMin)}
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
                  <button
                    onClick={() => { setMenuAberto(false); onEntrada(filtro) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    + Registrar Entrada
                  </button>
                  <button
                    onClick={() => { setMenuAberto(false); onBaixa(filtro) }}
                    disabled={quantidadeAtual <= 0}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Dar Baixa
                  </button>
                  <button
                    onClick={abrirAjuste}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Ajustar estoque
                  </button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={excluir}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Excluir filtro
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {estoqueMin > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${critico ? 'bg-red-500' : baixo ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-medium flex-shrink-0 ${critico ? 'text-red-600' : baixo ? 'text-yellow-600' : 'text-gray-500'}`}>
            {quantidadeAtual}/{estoqueMin} {filtro.unidade || 'un'}
          </span>
        </div>
      )}

      {(vencendo || vencido) && dataVal && (
        <p className={`text-xs mb-2 font-medium ${vencido ? 'text-red-600' : 'text-yellow-600'}`}>
          {vencido ? `Vencido em ${formatarData(dataVal)}` : `Vence em ${diasVal} dias`}
        </p>
      )}

      {ajustando ? (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <label className="block text-xs font-medium text-gray-600">Quantidade real em estoque</label>
          <input
            type="number" min="0" inputMode="numeric"
            value={valorAjuste}
            onChange={e => setValorAjuste(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && salvarAjuste()}
            className="input text-sm w-full"
            placeholder="0"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => setAjustando(false)} className="flex-1 text-xs btn-secondary py-1.5 justify-center">
              Cancelar
            </button>
            <button onClick={salvarAjuste} disabled={salvandoAjuste} className="flex-1 text-xs btn-primary py-1.5 justify-center">
              {salvandoAjuste ? 'Salvando...' : 'Salvar ajuste'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onEntrada(filtro)} className="flex-1 text-xs btn-primary py-1.5 justify-center">
            + Entrada
          </button>
          <button onClick={() => onBaixa(filtro)} className="flex-1 text-xs btn-secondary py-1.5 justify-center" disabled={quantidadeAtual <= 0}>
            Baixa
          </button>
        </div>
      )}

      {excluindo && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
