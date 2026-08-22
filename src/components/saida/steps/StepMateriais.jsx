import { useState, useMemo } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import ItemCard from '../ItemCard'
import NovoMaterialModal from '../../estoque/NovoMaterialModal'
import ScanPapelModal from '../ScanPapelModal'
import { materialPorQuantidade } from '../../../utils/formatters'
import { materialContado } from '../../estoque/contagem'

const CATEGORIAS = ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

export default function StepMateriais({ evento, itensSelecionados, onToggle, onQuantidade, onAvancar, onVoltar }) {
  const { dados: materiais, carregando } = useCollection('materiais')
  const [categoriaAtiva, setCategoriaAtiva] = useState('Cabos 4x')
  const [busca, setBusca] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [scanAberto, setScanAberto] = useState(false)

  // Insere na saida um material vindo do escaneamento do romaneio, sem duplicar o
  // que ja esta selecionado. Para material "por quantidade", aplica a quantidade lida.
  function adicionarEscaneado(material, quantidade) {
    if (itensSelecionados.some(i => i.id === material.id)) return
    onToggle(material, 'add')
    if ((materialPorQuantidade(material) || materialContado(material)) && quantidade > 1) {
      onQuantidade(material.id, quantidade)
    }
  }

  // Abas de categoria: padroes + categorias extras criadas pelo usuario.
  const categoriasTabs = useMemo(() => {
    const extras = [...new Set(materiais.map(m => m.categoria).filter(Boolean))]
      .filter(c => !CATEGORIAS.includes(c))
      .sort((a, b) => a.localeCompare(b))
    return [...CATEGORIAS, ...extras]
  }, [materiais])

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
        <td>${m.nome}${m.quantidade > 0 ? ` <strong>(${m.quantidade} un.)</strong>` : ''}</td>
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
        <title>Romaneio — ${evento?.nome || 'Saída'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #CC0000; padding-bottom: 14px; margin-bottom: 18px; }
          .header-left h1 { color: #CC0000; font-size: 20px; font-weight: 800; }
          .header-left p { color: #666; font-size: 12px; margin-top: 2px; }
          .header-right { text-align: right; font-size: 12px; color: #555; }
          .header-right strong { font-size: 14px; color: #1a1a1a; display: block; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
          th { background: #f5f5f5; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.4px; }
          td { padding: 7px 10px; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) td { background: #fafafa; }
          .mono { font-family: monospace; color: #CC0000; font-size: 12px; }
          .total-linha { margin-top: 14px; font-weight: 700; font-size: 13px; }

          .assinaturas { margin-top: 44px; page-break-inside: avoid; }
          .assinaturas-titulo { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 28px; }
          .assinaturas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
          .assinatura-linha { border-bottom: 1.5px solid #1a1a1a; margin-bottom: 6px; height: 36px; }
          .assinatura-label { font-size: 11px; color: #888; }

          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>SOS Energia</h1>
            <p>Romaneio de Saída de Material</p>
          </div>
          <div class="header-right">
            ${evento ? `<strong>${evento.nome}</strong>${evento.local} · ${new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : `<strong>Saída avulsa</strong>${new Date().toLocaleDateString('pt-BR')}`}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Material</th><th>Código</th><th>Categoria</th><th>Tipo</th><th>Bitola</th><th>Comprimento</th>
            </tr>
          </thead>
          <tbody>${linhasItens || '<tr><td colspan="6" style="color:#aaa;text-align:center;padding:16px">Nenhum material selecionado.</td></tr>'}</tbody>
        </table>
        <p class="total-linha">Total: ${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'item' : 'itens'}</p>

        <div class="assinaturas">
          <div class="assinaturas-titulo">Assinaturas</div>
          <div class="assinaturas-grid">
            <div>
              <div class="assinatura-linha"></div>
              <div class="assinatura-label">Almoxarife — Entregou</div>
            </div>
            <div>
              <div class="assinatura-linha"></div>
              <div class="assinatura-label">Responsável — Recebeu</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <span>Documento gerado em ${dataGeracao}</span>
          <span>SOS Energia — Almoxarifado</span>
        </div>
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

      <button
        onClick={() => setScanAberto(true)}
        className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-red/40 bg-red-50/50 hover:bg-red-50 px-4 py-3 text-left transition-colors"
      >
        <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-red text-white flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-brand-black">Escanear do papel</span>
          <span className="block text-xs text-gray-500">Tire uma foto do romaneio anotado à mão e a IA preenche os itens</span>
        </span>
      </button>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Buscar por nome ou código..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input flex-1"
        />
        <button
          onClick={() => setNovoAberto(true)}
          className="btn-secondary flex-shrink-0 gap-1.5 whitespace-nowrap"
          title="Cadastrar um material que ainda não existe no sistema"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Novo material
        </button>
      </div>

      {!busca && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoriasTabs.map(cat => (
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
          <button
            onClick={() => setNovoAberto(true)}
            className="btn-primary justify-center gap-1.5 mt-4 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Cadastrar este material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtrados.map(mat => (
            <ItemCard
              key={mat.id}
              material={mat}
              evento={evento}
              selecionado={itensSelecionados.some(i => i.id === mat.id)}
              quantidade={itensSelecionados.find(i => i.id === mat.id)?.quantidade}
              onAdicionar={() => onToggle(mat, 'add')}
              onRemover={() => onToggle(mat, 'remove')}
              onQuantidade={q => onQuantidade(mat.id, q)}
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

      {novoAberto && (
        <NovoMaterialModal
          onFechar={() => setNovoAberto(false)}
          onSalvo={() => {}}
        />
      )}

      {scanAberto && (
        <ScanPapelModal
          materiais={materiais}
          itensSelecionados={itensSelecionados}
          onAdicionar={adicionarEscaneado}
          onFechar={() => setScanAberto(false)}
        />
      )}
    </div>
  )
}
