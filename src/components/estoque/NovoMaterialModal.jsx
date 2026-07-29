import { useState, useMemo } from 'react'
import { db } from '../../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useCollection } from '../../hooks/useFirestore'

// Valor sentinela da opcao "criar categoria nova" no select de categoria.
const NOVA_CATEGORIA = '__nova__'

const CATEGORIAS = ['Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

const TIPOS_POR_CATEGORIA = {
  'Cabos 4x': ['Cabo único', 'Cabo com terra'],
  'Cabos 5x': ['Cabo único', 'Cabo com terra'],
  'Cabos Terra': ['Cabo terra simples', 'Cabo terra CAMLOCK'],
  'Cabos (Geral)': ['Cabo específico', 'Outro'],
  'Jogos de Cabo': ['Jogo 3F+N', 'Jogo 3F'],
  'Rabichos': ['Rabicho 3F+N', 'Rabicho 3F'],
  'Outros Materiais': [
    'Caixa de Passagem',
    'Caixa de Desconexão',
    'Caixa Blindada',
    'Chave Reversora',
    'QTA',
    'Passa-cabos',
    'Protetor de cabo',
    'Fita Isolante',
    'Fita de Alta Tensão',
    'Fita de Baixa Tensão',
    'Extintor',
    'Conector',
    'Equipamento',
    'Acessório',
    'Outro',
  ],
}

export default function NovoMaterialModal({ onFechar, onSalvo, inicial }) {
  // `inicial` pre-preenche o formulario (ex: vindo do escaneamento do romaneio).
  const [form, setForm] = useState(() => {
    const base = {
      nome: '',
      codigo: '',
      categoria: 'Outros Materiais',
      tipo: 'Caixa de Passagem',
      bitola: '',
      metragem: '',
      status: 'disponivel',
      estoqueAtual: 1,
      estoqueMin: 1,
      observacao: '',
    }
    if (!inicial) return base
    // Ignora campos vazios do inicial para nao sobrescrever os defaults com null/undefined.
    const limpo = Object.fromEntries(
      Object.entries(inicial).filter(([, v]) => v !== undefined && v !== null)
    )
    const merged = { ...base, ...limpo }
    // Ao herdar so a categoria, ajusta o tipo para o primeiro tipo valido dela.
    if (limpo.categoria && !limpo.tipo) {
      merged.tipo = TIPOS_POR_CATEGORIA[limpo.categoria]?.[0] || ''
    }
    return merged
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  // Categorias extras: derivadas dos materiais ja cadastrados. Assim, uma
  // categoria criada aqui passa a aparecer no dropdown nas proximas vezes,
  // sem precisar de colecao nova nem de mexer nas regras do Firestore.
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
      if (field === 'categoria') {
        next.tipo = TIPOS_POR_CATEGORIA[value]?.[0] || ''
      }
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
      const dados = {
        nome: form.nome.trim(),
        codigo: form.codigo.trim().toUpperCase(),
        categoria: categoriaFinal,
        subcategoria: categoriaFinal.toLowerCase().replace(/ /g, '_'),
        tipo: form.tipo,
        bitola: form.bitola.trim() || null,
        metragem: form.metragem.trim() || null,
        numero: null,
        status: form.status,
        eventoAtual: null,
        estoqueAtual: Number(form.estoqueAtual),
        estoqueMin: Number(form.estoqueMin),
        observacao: form.observacao.trim() || null,
      }
      const ref = await addDoc(collection(db, 'materiais'), { ...dados, criadoEm: serverTimestamp() })
      // Devolve o doc recem-criado (com id) para quem precisa usa-lo na hora, como o
      // escaneamento do romaneio. Chamadas antigas que ignoram o argumento seguem iguais.
      onSalvo({ id: ref.id, ...dados })
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Novo Material</h2>
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
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Cabo 4x35/66/20m" className="input" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Código *</label>
            <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
              placeholder="Ex: C43566" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bitola</label>
              <input value={form.bitola} onChange={e => set('bitola', e.target.value)}
                placeholder="Ex: 4x35" className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Comprimento</label>
              <input value={form.metragem} onChange={e => set('metragem', e.target.value)}
                placeholder="Ex: 20m" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Qtd. atual</label>
              <input type="number" min="0" value={form.estoqueAtual}
                onChange={e => set('estoqueAtual', e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Qtd. mínima</label>
              <input type="number" min="0" value={form.estoqueMin}
                onChange={e => set('estoqueMin', e.target.value)} className="input" />
            </div>
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
