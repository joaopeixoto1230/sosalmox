import { useState } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { statusGeradorCor, statusGeradorLabel } from '../../../utils/formatters'

export default function StepGerador({ onSelecionar, onVoltar }) {
  const { dados: geradores, carregando } = useCollection('geradores')
  const [selecionados, setSelecionados] = useState([])

  const disponiveis = geradores.filter(g => g.status === 'disponivel')

  function toggleGerador(gg) {
    setSelecionados(prev =>
      prev.some(g => g.id === gg.id)
        ? prev.filter(g => g.id !== gg.id)
        : [...prev, gg]
    )
  }

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
        <h2 className="text-lg font-bold text-brand-black">Selecionar Geradores</h2>
        <p className="text-sm text-gray-500">Selecione um ou mais geradores para esta saída.</p>
      </div>

      {disponiveis.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhum gerador disponível no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {disponiveis.map(gg => {
            const selecionado = selecionados.some(g => g.id === gg.id)
            return (
              <button
                key={gg.id}
                onClick={() => toggleGerador(gg)}
                className={`card text-left transition-all w-full ${
                  selecionado
                    ? 'border-brand-red shadow-md bg-brand-red/5'
                    : 'hover:border-brand-red hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selecionado ? 'bg-brand-red border-brand-red' : 'border-gray-300'
                  }`}>
                    {selecionado && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold transition-colors ${selecionado ? 'text-brand-red' : 'text-brand-black'}`}>
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
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-3 sticky bottom-0 bg-brand-bg pb-1 pt-2">
        <button onClick={onVoltar} className="btn-ghost">
          ← Voltar
        </button>
        <button
          onClick={() => onSelecionar([])}
          className="btn-secondary"
        >
          Sem gerador
        </button>
        <button
          onClick={() => onSelecionar(selecionados)}
          disabled={selecionados.length === 0}
          className="btn-primary flex-1 justify-center disabled:opacity-40"
        >
          {selecionados.length === 0
            ? 'Selecione geradores'
            : `Continuar (${selecionados.length}) →`
          }
        </button>
      </div>
    </div>
  )
}
