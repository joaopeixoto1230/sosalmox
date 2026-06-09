import { useState, useMemo } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import ItemCard from '../ItemCard'
import { formatarData } from '../../../utils/formatters'

const CATEGORIAS = ['Cabos 4x', 'Cabos Terra', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

export default function StepMateriais({ itensSelecionados, onToggle, onAvancar, onVoltar }) {
  const { dados: materiais, carregando } = useCollection('materiais')
  const [categoriaAtiva, setCategoriaAtiva] = useState('Cabos 4x')
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    return materiais.filter(m => {
      const matchCategoria = busca ? true : m.categoria === categoriaAtiva
      const matchBusca = busca
        ? m.nome.toLowerCase().includes(busca.toLowerCase()) ||
          m.codigo.toLowerCase().includes(busca.toLowerCase())
        : true
      return matchCategoria && matchBusca
    })
  }, [materiais, categoriaAtiva, busca])

  const countSelecionados = itensSelecionados.length

  function gerarRelatorio() {
    const dataGeracao = new Date().toLocaleString('pt-BR')
    const linhasItens = itensSelecionados.map(m =>
      `<tr>
        <td>${m.nome}</td>
        <td>${m.codigo}</td>
        <td>${m.categoria}</td>
        <td>${m.tipo}</td>
        <td>${m.bitola || '—'}</td>
        <td>${m.metragem || '—'}</td>
      </tr>`
    ).join('')

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Romaneio de Saída</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
          h1 { color: #CC0000; margin: 0 0 4px; }
          .header { margin-bottom: 20px; }
          .header p { margin: 2px 0; color: #555; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background: #f0f0f0; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ccc; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; }
          tr:last-child td { border-bottom: none; }
          .footer { margin-top: 24px; font-size: 12px; color: #888; }
          .total { font-weight: bold; margin-top: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SOS Energia — Romaneio de Saída</h1>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Material</th><th>Código</th><th>Categoria</th><th>Tipo</th><th>Bitola</th><th>Comprimento</th>
            </tr>
          </thead>
          <tbody>${linhasItens || '<tr><td colspan="6">Nenhum material selecionado.</td></tr>'}</tbody>
        </table>
        <p class="total">Total: ${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'item' : 'itens'}</p>
        <div class="footer">Gerado em ${dataGeracao}</div>
      </body>
      </html>
    `
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-black">Selecionar Materiais</h2>
          <p className="text-sm text-gray-500">Navegue pelas categorias e adicione os itens.</p>
        </div>
        {countSelecionados > 0 && (
          <div className="bg-brand-red text-white text-sm font-bold px-3 py-1 rounded-full flex-shrink-0">
            {countSelecionados} {countSelecionados === 1 ? 'item' : 'itens'}
          </div>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar por nome ou código..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="input"
      />

      {!busca && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                ${categoriaAtiva === cat
                  ? 'bg-brand-red text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
          <p>Nenhum material encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtrados.map(mat => (
            <ItemCard
              key={mat.id}
              material={mat}
              selecionado={itensSelecionados.some(i => i.id === mat.id)}
              onAdicionar={() => onToggle(mat, 'add')}
              onRemover={() => onToggle(mat, 'remove')}
              onGerarRelatorio={gerarRelatorio}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2 sticky bottom-0 bg-brand-bg pb-1">
        <button onClick={onVoltar} className="btn-secondary">
          ← Voltar
        </button>
        <button
          onClick={onAvancar}
          disabled={countSelecionados === 0}
          className="btn-primary flex-1 justify-center"
        >
          Revisar Romaneio ({countSelecionados}) →
        </button>
      </div>
    </div>
  )
}
