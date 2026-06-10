import { useState } from 'react'
import { db } from '../../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

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

export default function NovoMaterialModal({ onFechar, onSalvo }) {
  const [form, setForm] = useState({
    nome: '',
    codigo: '',
    categoria: 'Outros Materiais',
    tipo: 'Caixa de Passagem',
    bitola: '',
    metragem: '',
    status: 'disponivel',
    estoqueAtual: 1,
    estoqueMin: 1,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'categoria') {
        next.tipo = TIPOS_POR_CATEGORIA[value][0]
      }
      return next
    })
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.codigo.trim()) { setErro('Código é obrigatório'); return }
    setSalvando(true)
    setErro('')
    try {
      await addDoc(collection(db, 'materiais'), {
        nome: form.nome.trim(),
        codigo: form.codigo.trim().toUpperCase(),
        categoria: form.categoria,
        subcategoria: form.categoria.toLowerCase().replace(/ /g, '_'),
        tipo: form.tipo,
        bitola: form.bitola.trim() || null,
        metragem: form.metragem.trim() || null,
        numero: null,
        status: form.status,
        eventoAtual: null,
        estoqueAtual: Number(form.estoqueAtual),
        estoqueMin: Number(form.estoqueMin),
        criadoEm: serverTimestamp(),
      })
      onSalvo()
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
