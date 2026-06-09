import { useCollection } from '../../../hooks/useFirestore'
import { statusGeradorCor, statusGeradorLabel } from '../../../utils/formatters'

export default function StepGerador({ onSelecionar, onVoltar }) {
  const { dados: geradores, carregando } = useCollection('geradores')

  const disponiveis = geradores.filter(g => g.status === 'disponivel')

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">Selecionar Gerador</h2>
        <p className="text-sm text-gray-500">Selecione o gerador vinculado a esta saída (opcional).</p>
      </div>

      <button
        onClick={() => onSelecionar(null)}
        className="card text-left hover:border-brand-red hover:shadow-md transition-all group w-full border-dashed"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-500 group-hover:text-gray-700 transition-colors">Sem gerador vinculado</p>
            <p className="text-xs text-gray-400">Saída de material sem gerador específico</p>
          </div>
        </div>
      </button>

      {disponiveis.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhum gerador disponível no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {disponiveis.map(gg => (
            <button
              key={gg.id}
              onClick={() => onSelecionar(gg)}
              className="card text-left hover:border-brand-red hover:shadow-md transition-all group w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-brand-black group-hover:text-brand-red transition-colors">
                      {gg.codigo}
                    </p>
                    <span className={`badge ${statusGeradorCor(gg.status)}`}>
                      {statusGeradorLabel(gg.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{gg.potencia} • {gg.marca} {gg.modelo}</p>
                  {gg.horimetro && (
                    <p className="text-xs text-gray-400">Horímetro: {gg.horimetro}h</p>
                  )}
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-red transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {onVoltar && (
        <button onClick={onVoltar} className="btn-ghost w-full justify-center">
          ← Voltar
        </button>
      )}
    </div>
  )
}
