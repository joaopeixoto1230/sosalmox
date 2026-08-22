import { useState, useMemo } from 'react'
import { db } from '../../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useCollection } from '../../hooks/useFirestore'
import { GRUPOS, CATEGORIAS_POR_GRUPO, TIPOS_POR_CATEGORIA, categoriasDoGrupo } from './categorias'

// Valor sentinela da opcao "criar categoria nova" no select de categoria.
const NOVA_CATEGORIA = '__nova__'

export default function NovoMaterialModal({ onFechar, onSalvo, inicial, grupoFixo }) {
  // `inicial` pre-preenche o formulario (ex: vindo do escaneamento do romaneio).
  // `grupoFixo` trava o grupo (ex: aberto da aba Material Interno do Estoque) e
  // esconde o seletor — o modal mostra so as categorias daquele grupo.
  const [form, setForm] = useState(() => {
    const grupoInicial = grupoFixo || 'eventos'
    const categoriaInicial = grupoInicial === 'uso_interno'
      ? CATEGORIAS_POR_GRUPO.uso_interno[0]
      : 'Outros Materiais'
    const base = {
      grupo: grupoInicial,
      nome: '',
      codigo: '',
      categoria: categoriaInicial,
      tipo: TIPOS_POR_CATEGORIA[categoriaInicial]?.[0] || '',
      bitola: '',
      metragem: '',
      status: 'disponivel',
      estoqueAtual: 1,
      estoqueMin: 1,
      observacao: '',
      porQuantidade: false,
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

  // Categorias extras: derivadas dos materiais ja cadastrados no grupo. Assim,
  // uma categoria criada aqui passa a aparecer no dropdown nas proximas vezes,
  // sem precisar de colecao nova nem de mexer nas regras do Firestore.
  const { dados: materiaisAll } = useCollection('materiais')
  const categoriasNomes = useMemo(
    () => categoriasDoGrupo(form.grupo, materiaisAll),
    [form.grupo, materiaisAll]
  )

  const categoriaFinal = form.categoria === NOVA_CATEGORIA ? novaCategoria.trim() : form.categoria
  const tiposDaCategoria = TIPOS_POR_CATEGORIA[categoriaFinal] || []

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'categoria') {
        next.tipo = TIPOS_POR_CATEGORIA[value]?.[0] || ''
      }
      if (field === 'grupo') {
        // Ao trocar de grupo, cai na primeira categoria dele (e no primeiro tipo dela).
        next.categoria = CATEGORIAS_POR_GRUPO[value]?.[0] || ''
        next.tipo = TIPOS_POR_CATEGORIA[next.categoria]?.[0] || ''
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
        grupo: form.grupo,
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
        porQuantidade: form.porQuantidade === true,
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
          <div>
            <h2 className="font-bold text-brand-black">Novo Material</h2>
            {grupoFixo && (
              <p className="text-xs text-gray-500 mt-0.5">
                {GRUPOS.find(g => g.value === grupoFixo)?.label}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!grupoFixo && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Grupo</label>
              <div className="grid grid-cols-2 gap-1.5 bg-gray-100 rounded-xl p-1">
                {GRUPOS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => set('grupo', g.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors
                      ${form.grupo === g.value ? 'bg-brand-red text-white' : 'text-gray-600 hover:text-brand-red'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <label className="flex items-start gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.porQuantidade}
              onChange={e => set('porQuantidade', e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-red focus:ring-brand-red flex-shrink-0"
            />
            <span className="text-xs text-gray-600">
              <b className="text-brand-black block">Controlado por quantidade</b>
              Para o que sai em várias unidades do mesmo cadastro (alambrado, fita, parafuso):
              saem 10 de 50 e sobram 40. Sem marcar, o cadastro sai inteiro e volta inteiro.
            </span>
          </label>


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
