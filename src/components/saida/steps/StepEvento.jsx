import { useState } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../../utils/formatters'

export default function StepEvento({ onSelecionar }) {
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')

  const filtrados = eventos
    .filter(e => ['ativo', 'agendado'].includes(e.status))
    .filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.local.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => new Date(a.data) - new Date(b.data))

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
        <h2 className="text-lg font-bold text-brand-black">Selecionar Evento</h2>
        <p className="text-sm text-gray-500">Escolha o evento para registrar a saída de material.</p>
      </div>

      <input
        type="search"
        placeholder="Buscar evento por nome ou local..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="input"
      />

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm">Verifique o status ou o nome do evento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(evt => (
            <button
              key={evt.id}
              onClick={() => onSelecionar(evt)}
              className="card text-left hover:border-brand-red hover:shadow-md transition-all group w-full"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors truncate">
                    {evt.nome}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {evt.local}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatarData(evt.data)}</p>
                </div>
                <span className={`badge flex-shrink-0 ${statusEventoCor(evt.status)}`}>
                  {statusEventoLabel(evt.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
