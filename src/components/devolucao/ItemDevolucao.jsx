const STATUS_OPCOES = [
  { valor: 'ok', label: '✅ OK', cor: 'border-green-500 bg-green-50 text-green-700' },
  { valor: 'problema', label: '⚠️ Com problema', cor: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
  { valor: 'cortado', label: '✂️ Cortado', cor: 'border-orange-500 bg-orange-50 text-orange-700' },
  { valor: 'perdido', label: '❌ Perdido', cor: 'border-red-500 bg-red-50 text-red-700' },
  { valor: 'parcial', label: '🔄 Parcial', cor: 'border-blue-500 bg-blue-50 text-blue-700' },
  { valor: 'aguardando', label: '⏳ Aguardando', cor: 'border-gray-400 bg-gray-50 text-gray-600' },
]

export default function ItemDevolucao({ item, statusAtual, descricao, onStatus, onDescricao }) {
  const opcaoAtiva = STATUS_OPCOES.find(o => o.valor === statusAtual)

  return (
    <div className={`card border-l-4 ${opcaoAtiva ? opcaoAtiva.cor.split(' ')[0] : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-brand-black text-sm">{item.nome}</p>
          <p className="text-xs text-brand-red font-mono">{item.codigo}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.categoria}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {STATUS_OPCOES.map(opcao => (
          <button
            key={opcao.valor}
            onClick={() => onStatus(item.id, opcao.valor)}
            className={`
              px-2 py-1.5 rounded-lg text-xs font-medium border transition-all text-center
              ${statusAtual === opcao.valor
                ? opcao.cor
                : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
              }
            `}
          >
            {opcao.label}
          </button>
        ))}
      </div>

      {(statusAtual === 'problema' || statusAtual === 'cortado') && (
        <input
          type="text"
          placeholder="Descreva o problema ou dano..."
          value={descricao || ''}
          onChange={e => onDescricao(item.id, e.target.value)}
          className="input text-sm"
          required
        />
      )}

      {statusAtual === 'parcial' && (
        <input
          type="text"
          placeholder="O que voltou / o que ainda vem..."
          value={descricao || ''}
          onChange={e => onDescricao(item.id, e.target.value)}
          className="input text-sm"
        />
      )}
    </div>
  )
}
