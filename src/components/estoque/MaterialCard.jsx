import { useState, useMemo } from 'react'
import { db } from '../../firebase/config'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { statusMaterialCor, statusMaterialLabel } from '../../utils/formatters'
import { useCollection } from '../../hooks/useFirestore'

// Valor sentinela da opcao "criar categoria nova" no select de categoria.
const NOVA_CATEGORIA = '__nova__'

const STATUS_OPCOES = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'em_evento', label: 'Em Evento' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'perdido', label: 'Perdido' },
]

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

export default function MaterialCard({ material, evento }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [alterando, setAlterando] = useState(false)
  const [editando, setEditando] = useState(false)

  const estoqueBaixo = material.estoqueAtual <= material.estoqueMin && material.estoqueMin > 0

  async function trocarStatus(novoStatus) {
    setAlterando(true)
    setMenuAberto(false)
    try {
      await updateDoc(doc(db, 'materiais', material.id), { status: novoStatus })
    } finally {
      setAlterando(false)
    }
  }

  async function excluir() {
    setMenuAberto(false)
    if (!window.confirm(`Excluir "${material.nome}"? Esta ação não pode ser desfeita.`)) return
    await deleteDoc(doc(db, 'materiais', material.id))
  }

  return (
    <div className={`card transition-all hover:shadow-md ${estoqueBaixo ? 'border-red-200' : ''} relative`}>
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 min-w-0 font-bold text-brand-black text-sm leading-snug">{material.nome}</p>
          <div className="relative flex-shrink-0">
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
                  <p className="text-xs font-semibold text-gray-400 px-3 py-1.5">Trocar status</p>
                  {STATUS_OPCOES.map(s => (
                    <button key={s.value} onClick={() => trocarStatus(s.value)}
                      disabled={material.status === s.value}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors
                        ${material.status === s.value
                          ? 'text-brand-red font-semibold bg-red-50'
                          : 'text-gray-700 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { setMenuAberto(false); setEditando(true) }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar material
                    </button>
                    <button onClick={excluir}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                      Excluir item
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-brand-red font-mono">{material.codigo}</span>
          <span className={`badge ${statusMaterialCor(material.status)}`}>
            {statusMaterialLabel(material.status)}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 text-xs text-gray-500 mb-3">
        <p>{material.categoria} • {material.tipo}</p>
        {material.bitola && <p>Bitola: <span className="font-medium text-gray-700">{material.bitola}</span></p>}
        {material.metragem && <p>Comprimento: <span className="font-medium text-gray-700">{material.metragem}</span></p>}
        {material.status === 'em_evento' && material.eventoAtual && (
          <p className="text-yellow-600 font-medium truncate">
            📍 {evento ? evento.nome : material.eventoAtual}
            {evento?.local ? ` · ${evento.local}` : ''}
          </p>
        )}
        {material.observacao && (
          <p className="text-orange-600 italic truncate">⚠ {material.observacao}</p>
        )}
      </div>

      {material.estoqueMin > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${estoqueBaixo ? 'bg-brand-red' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (material.estoqueAtual / material.estoqueMin) * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${estoqueBaixo ? 'text-brand-red' : 'text-gray-500'}`}>
            {material.estoqueAtual}/{material.estoqueMin}
          </span>
          {estoqueBaixo && (
            <span className="text-brand-red" title="Estoque baixo">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
      )}

      {alterando && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {editando && (
        <ModalEditarMaterial material={material} onFechar={() => setEditando(false)} />
      )}
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
    observacao: material.observacao || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  const { dados: materiaisAll } = useCollection('materiais')
  const categoriasNomes = useMemo(() => {
    const extras = [...new Set(materiaisAll.map(m => m.categoria).filter(Boolean))]
      .filter(c => !CATEGORIAS.includes(c))
      .sort((a, b) => a.localeCompare(b))
    return [...CATEGORIAS, ...extras]
  }, [materiaisAll])

  const categoriaFinal = form.categoria === NOVA_CATEGORIA ? novaCategoria.trim() : form.categoria
  const tiposDaCategoria = TIPOS_POR_CATEGORIA[categoriaFinal] || []

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
    if (!categoriaFinal) { setErro('Informe o nome da nova categoria'); return }
    setSalvando(true)
    setErro('')
    try {
      await updateDoc(doc(db, 'materiais', material.id), {
        nome: form.nome.trim(),
        codigo: form.codigo.trim().toUpperCase(),
        categoria: categoriaFinal,
        subcategoria: categoriaFinal.toLowerCase().replace(/ /g, '_'),
        tipo: form.tipo,
        bitola: form.bitola.trim() || null,
        metragem: form.metragem.trim() || null,
        estoqueAtual: Number(form.estoqueAtual),
        estoqueMin: Number(form.estoqueMin),
        status: form.status,
        observacao: form.observacao.trim() || null,
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
              {categoriasNomes.map(c => <option key={c}>{c}</option>)}
              <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
            </select>
            {form.categoria === NOVA_CATEGORIA && (
              <input
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value)}
                placeholder="Nome da nova categoria"
                className="input mt-2"
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
            {tiposDaCategoria.length > 0 ? (
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input">
                {tiposDaCategoria.map(t => <option key={t}>{t}</option>)}
              </select>
            ) : (
              <input
                value={form.tipo}
                onChange={e => set('tipo', e.target.value)}
                placeholder="Ex: tipo do material (opcional)"
                className="input"
              />
            )}
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

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea
              value={form.observacao}
              onChange={e => set('observacao', e.target.value)}
              placeholder="Ex: cabo com emenda no meio, conector torto, uso restrito..."
              rows={3}
              className="input resize-none"
            />
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
