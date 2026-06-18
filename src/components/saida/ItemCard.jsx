import { useState } from 'react'
import { db } from '../../firebase/config'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { materialPorQuantidade } from '../../utils/formatters'

const CATEGORIAS = ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

const TIPOS_POR_CATEGORIA = {
  'Cabos 4x': ['Cabo único', 'Cabo com terra'],
  'Cabos 5x': ['Cabo único', 'Cabo com terra'],
  'Cabos Terra': ['Cabo terra simples', 'Cabo terra CAMLOCK'],
  'Cabos (Geral)': ['Cabo específico', 'Outro'],
  'Jogos de Cabo': ['Jogo 3F+N', 'Jogo 3F'],
  'Rabichos': ['Rabicho 3F+N', 'Rabicho 3F'],
  'Outros Materiais': [
    'Caixa de Passagem', 'Caixa de Desconexão', 'Caixa Blindada',
    'Chave Reversora', 'QTA', 'Passa-cabos', 'Protetor de cabo',
    'Fita Isolante', 'Fita de Alta Tensão', 'Fita de Baixa Tensão',
    'Extintor', 'Conector', 'Equipamento', 'Acessório', 'Outro',
  ],
}

export default function ItemCard({ material, evento, selecionado, quantidade, onAdicionar, onRemover, onQuantidade, onGerarRelatorio }) {
  const { tipoPerfil } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editandoStatus, setEditandoStatus] = useState(false)
  const [detalhes, setDetalhes] = useState(false)
  const ehQtd = materialPorQuantidade(material)
  // Materiais por quantidade (protetor de cabo) nunca ficam indisponiveis:
  // saem em varias unidades e nao prendem estoque a um evento.
  const disponivel = ehQtd ? true : (material.status === 'disponivel' && material.estoqueAtual > 0)
  const podeGerenciar = ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)

  async function excluir() {
    setMenuAberto(false)
    if (!window.confirm(`Excluir "${material.nome}"? Esta ação não pode ser desfeita.`)) return
    await deleteDoc(doc(db, 'materiais', material.id))
  }

  return (
    <>
      <div
        className={`
          card relative transition-all cursor-pointer
          ${selecionado ? 'border-brand-red ring-2 ring-brand-red/20 shadow-md' : ''}
          ${!disponivel ? 'opacity-60' : 'hover:shadow-md hover:border-gray-200'}
        `}
        onClick={() => setDetalhes(true)}
      >
        {selecionado && (
          <div className="absolute top-2 left-2 w-5 h-5 bg-brand-red rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {podeGerenciar && (
          <div className="absolute top-2 right-2">
            <button
              onClick={e => { e.stopPropagation(); setMenuAberto(v => !v) }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setMenuAberto(false) }} />
                <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-40 py-1 overflow-hidden">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuAberto(false); setEditandoStatus(true) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Editar status
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuAberto(false); setEditando(true) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar material
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); excluir() }}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Excluir item
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mb-3 mt-1">
          <p className="font-bold text-brand-black text-sm leading-tight pr-6">{material.nome}</p>
          <p className="text-xs text-brand-red font-mono mt-0.5">{material.codigo}</p>
        </div>

        <div className="space-y-0.5 mb-3">
          {material.bitola && (
            <p className="text-xs text-gray-500">Bitola: <span className="font-medium text-gray-700">{material.bitola}</span></p>
          )}
          {material.metragem && (
            <p className="text-xs text-gray-500">Comprimento: <span className="font-medium text-gray-700">{material.metragem}</span></p>
          )}
          <p className="text-xs text-gray-500">Tipo: <span className="font-medium text-gray-700">{material.tipo}</span></p>
        </div>

        <div className="flex items-center justify-between gap-2">
          {ehQtd ? (
            <span className="badge bg-green-100 text-green-700">Por qtd.</span>
          ) : material.status === 'disponivel' && material.estoqueAtual > 0 ? (
            <span className="badge bg-green-100 text-green-700">Disponível</span>
          ) : material.status === 'em_evento' ? (
            <span className="badge bg-yellow-100 text-yellow-700 truncate max-w-[120px]" title={`Em: ${material.eventoAtual}`}>
              Em evento
            </span>
          ) : (
            <span className="badge bg-red-100 text-red-700">Indisponível</span>
          )}

          {disponivel && !(ehQtd && selecionado) && (
            selecionado ? (
              <button
                onClick={e => { e.stopPropagation(); onRemover() }}
                className="w-7 h-7 bg-brand-red rounded-lg text-white flex items-center justify-center hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onAdicionar() }}
                className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 flex items-center justify-center hover:bg-brand-red hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )
          )}
        </div>

        {disponivel && ehQtd && selecionado && (
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">Quantidade</span>
              <button
                onClick={onRemover}
                className="text-xs font-medium text-gray-400 hover:text-brand-red transition-colors"
              >
                Remover
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onQuantidade(Math.max(1, (quantidade || 1) - 1))}
                className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <input
                type="number"
                min="1"
                value={quantidade || 1}
                onChange={e => onQuantidade(Math.max(1, Number(e.target.value) || 1))}
                className="flex-1 w-full min-w-0 h-9 text-center text-base font-bold text-brand-black bg-gray-50 border border-gray-200 rounded-lg focus:border-brand-red focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => onQuantidade((quantidade || 1) + 1)}
                className="w-9 h-9 rounded-lg bg-brand-red text-white flex items-center justify-center hover:bg-red-700 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {detalhes && (
        <ModalDetalhes
          material={material}
          evento={evento}
          onFechar={() => setDetalhes(false)}
          onGerarRelatorio={onGerarRelatorio}
        />
      )}

      {editandoStatus && (
        <ModalEditarStatus material={material} onFechar={() => setEditandoStatus(false)} />
      )}

      {editando && (
        <ModalEditarMaterial material={material} onFechar={() => setEditando(false)} />
      )}
    </>
  )
}

const STATUS_OPCOES = [
  { value: 'disponivel', label: 'Disponível', cor: 'bg-green-100 text-green-700 border-green-200', desc: 'Pronto para uso' },
  { value: 'em_evento', label: 'Em Evento', cor: 'bg-yellow-100 text-yellow-700 border-yellow-200', desc: 'Fora do almoxarifado' },
  { value: 'manutencao', label: 'Manutenção', cor: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Em reparo ou revisão' },
  { value: 'perdido', label: 'Perdido', cor: 'bg-red-100 text-red-700 border-red-200', desc: 'Não localizado' },
]

function ModalEditarStatus({ material, onFechar }) {
  const [salvando, setSalvando] = useState(false)

  async function salvarStatus(novoStatus) {
    if (novoStatus === material.status) { onFechar(); return }
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'materiais', material.id), {
        status: novoStatus,
        estoqueAtual: novoStatus === 'disponivel' ? 1 : 0,
        eventoAtual: novoStatus === 'disponivel' ? null : material.eventoAtual,
      })
      onFechar()
    } catch (e) {
      console.error(e)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-brand-black text-sm">Editar status</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{material.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {STATUS_OPCOES.map(op => (
            <button
              key={op.value}
              onClick={() => salvarStatus(op.value)}
              disabled={salvando}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                material.status === op.value
                  ? op.cor + ' border-current'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div>
                <p className="font-semibold text-sm">{op.label}</p>
                <p className="text-xs opacity-70">{op.desc}</p>
              </div>
              {material.status === op.value && (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModalDetalhes({ material, evento, onFechar, onGerarRelatorio }) {
  const statusLabel = {
    disponivel: 'Disponível',
    em_evento: 'Em Evento',
    manutencao: 'Manutenção',
    perdido: 'Perdido',
  }
  const statusCor = {
    disponivel: 'bg-green-100 text-green-700',
    em_evento: 'bg-yellow-100 text-yellow-700',
    manutencao: 'bg-blue-100 text-blue-700',
    perdido: 'bg-red-100 text-red-700',
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Detalhes do material</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {evento && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Evento</p>
              <p className="font-semibold text-brand-black">{evento.nome}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {evento.local}
              </p>
              <p className="text-xs text-gray-400">
                {evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Material</p>

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-brand-black">{material.nome}</p>
                <p className="text-xs text-brand-red font-mono">{material.codigo}</p>
              </div>
              <span className={`badge flex-shrink-0 ${statusCor[material.status] || 'bg-gray-100 text-gray-700'}`}>
                {statusLabel[material.status] || material.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Categoria</p>
                <p className="font-medium text-gray-700">{material.categoria || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tipo</p>
                <p className="font-medium text-gray-700">{material.tipo || '—'}</p>
              </div>
              {material.bitola && (
                <div>
                  <p className="text-xs text-gray-400">Bitola</p>
                  <p className="font-medium text-gray-700">{material.bitola}</p>
                </div>
              )}
              {material.metragem && (
                <div>
                  <p className="text-xs text-gray-400">Comprimento</p>
                  <p className="font-medium text-gray-700">{material.metragem}</p>
                </div>
              )}
              {material.estoqueMin > 0 && (
                <>
                  <div>
                    <p className="text-xs text-gray-400">Qtd. atual</p>
                    <p className="font-medium text-gray-700">{material.estoqueAtual}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Qtd. mínima</p>
                    <p className="font-medium text-gray-700">{material.estoqueMin}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Fechar</button>
            {onGerarRelatorio && (
              <button
                onClick={() => { onFechar(); onGerarRelatorio() }}
                className="btn-primary flex-1 justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Gerar Relatório
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalEditarMaterial({ material, onFechar }) {
  const [form, setForm] = useState({
    nome: material.nome || '',
    codigo: material.codigo || '',
    categoria: material.categoria || 'Outros Materiais',
    tipo: material.tipo || '',
    bitola: material.bitola || '',
    metragem: material.metragem || '',
    estoqueAtual: material.estoqueAtual ?? 0,
    estoqueMin: material.estoqueMin ?? 0,
    status: material.status || 'disponivel',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'categoria') next.tipo = TIPOS_POR_CATEGORIA[value]?.[0] || ''
      return next
    })
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.codigo.trim()) { setErro('Código é obrigatório'); return }
    setSalvando(true)
    setErro('')
    try {
      await updateDoc(doc(db, 'materiais', material.id), {
        nome: form.nome.trim(),
        codigo: form.codigo.trim().toUpperCase(),
        categoria: form.categoria,
        subcategoria: form.categoria.toLowerCase().replace(/ /g, '_'),
        tipo: form.tipo,
        bitola: form.bitola.trim() || null,
        metragem: form.metragem.trim() || null,
        estoqueAtual: Number(form.estoqueAtual),
        estoqueMin: Number(form.estoqueMin),
        status: form.status,
      })
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Editar material</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="input">
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input">
              {(TIPOS_POR_CATEGORIA[form.categoria] || []).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input" autoFocus />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Código *</label>
            <input value={form.codigo} onChange={e => set('codigo', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bitola</label>
              <input value={form.bitola} onChange={e => set('bitola', e.target.value)} placeholder="Ex: 4x35" className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Comprimento</label>
              <input value={form.metragem} onChange={e => set('metragem', e.target.value)} placeholder="Ex: 20m" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Qtd. atual</label>
              <input type="number" min="0" value={form.estoqueAtual} onChange={e => set('estoqueAtual', e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Qtd. mínima</label>
              <input type="number" min="0" value={form.estoqueMin} onChange={e => set('estoqueMin', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
              <option value="disponivel">Disponível</option>
              <option value="em_evento">Em Evento</option>
              <option value="manutencao">Manutenção</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
