import { useMemo } from 'react'
import { normalizarRef as normRef } from './filtrosUtils'

export default function FiltrosIguaisModal({ filtros, onFechar }) {
  const grupos = useMemo(() => {
    const map = new Map()
    filtros
      .filter(f => f.ativo !== false)
      .forEach(f => {
        const key = normRef(f.referencia)
        if (!key) return // sem referência não dá para comparar
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(f)
      })

    // só os que aparecem em MAIS DE UMA potência diferente
    const iguais = []
    for (const [, itens] of map) {
      const potencias = [...new Set(itens.map(i => i.potenciaGG || 'Outros'))]
      if (potencias.length > 1) {
        iguais.push({
          referencia: itens[0].referencia,
          nome: itens[0].nome,
          potencias,
          total: itens.reduce((s, i) => s + (i.quantidadeAtual || 0), 0),
          itens: [...itens].sort((a, b) => (parseInt(a.potenciaGG) || 9999) - (parseInt(b.potenciaGG) || 9999)),
        })
      }
    }
    return iguais.sort((a, b) => b.potencias.length - a.potencias.length || normRef(a.referencia).localeCompare(normRef(b.referencia)))
  }, [filtros])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Filtros iguais em potências diferentes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Mesma referência usada em mais de uma potência • {grupos.length} {grupos.length === 1 ? 'filtro' : 'filtros'}
            </p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {grupos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">Nenhum filtro com a mesma referência em potências diferentes.</p>
              <p className="text-xs mt-1">Filtros sem referência cadastrada não entram na comparação.</p>
            </div>
          ) : (
            grupos.map(g => (
              <div key={normRef(g.referencia)} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-red font-mono text-sm">{g.referencia}</p>
                    <p className="text-sm text-brand-black truncate">{g.nome}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    Total: {g.total} un
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {g.potencias.map(p => (
                    <span key={p} className="text-xs font-medium bg-brand-red/10 text-brand-red px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
                <div className="mt-2 space-y-0.5">
                  {g.itens.map(i => (
                    <p key={i.id} className="text-xs text-gray-500">
                      • <span className="font-medium text-gray-600">{i.potenciaGG || 'Outros'}</span> — {i.nome} — estoque {i.quantidadeAtual || 0} un
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100">
          <button onClick={onFechar} className="btn-secondary w-full justify-center">Fechar</button>
        </div>
      </div>
    </div>
  )
}
