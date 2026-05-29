import { statusFiltroLabel, statusFiltroCor, formatarData } from '../../utils/formatters'

export default function FiltroCard({ filtro, onEntrada, onBaixa }) {
  const { quantidadeAtual = 0, estoqueMin = 0, validade } = filtro
  const pct = estoqueMin > 0 ? Math.min(100, (quantidadeAtual / estoqueMin) * 100) : 100
  const critico = quantidadeAtual <= 0
  const baixo = !critico && quantidadeAtual <= estoqueMin

  const hoje = new Date()
  const dataVal = validade?.toDate ? validade.toDate() : validade ? new Date(validade) : null
  const diasVal = dataVal ? Math.ceil((dataVal - hoje) / 86400000) : null
  const vencendo = diasVal !== null && diasVal <= 30 && diasVal > 0
  const vencido = diasVal !== null && diasVal <= 0

  return (
    <div className={`card border-l-4 ${critico ? 'border-red-500' : baixo ? 'border-yellow-500' : 'border-green-500'}`}>
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
        <span className={`badge flex-shrink-0 ${statusFiltroCor(quantidadeAtual, estoqueMin)}`}>
          {statusFiltroLabel(quantidadeAtual, estoqueMin)}
        </span>
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

      <div className="flex gap-2 mt-3">
        <button onClick={() => onEntrada(filtro)} className="flex-1 text-xs btn-primary py-1.5 justify-center">
          + Entrada
        </button>
        <button onClick={() => onBaixa(filtro)} className="flex-1 text-xs btn-secondary py-1.5 justify-center" disabled={quantidadeAtual <= 0}>
          Baixa
        </button>
      </div>
    </div>
  )
}
