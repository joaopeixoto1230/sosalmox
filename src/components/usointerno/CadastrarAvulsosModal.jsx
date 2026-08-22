import { useState, useMemo } from 'react'
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { CATEGORIAS_POR_GRUPO, TIPOS_POR_CATEGORIA } from '../estoque/categorias'
import { categoriaSugerida, codigoSugerido, jaCadastrado } from './sugestaoCadastro'

// Cadastra no estoque (grupo Material Interno) os itens que saíram como avulsos.
//
// Item avulso é o que foi digitado na hora da saída porque não existia no
// estoque. O que sai toda semana merece cadastro — senão nunca dá para saber
// quanto tem na prateleira nem quando acabou.
//
// A tela sugere categoria e código, mas nada é gravado sem confirmação, e o
// que já tem material com o mesmo nome vem bloqueado para não duplicar.

const POR_LOTE = 400 // writeBatch do Firestore aceita ate 500 operacoes

export default function CadastrarAvulsosModal({ itens, materiais, onFechar, onSalvo }) {
  // Um código só pode existir uma vez: junta os do estoque com os já sugeridos
  // aqui, senão dois itens novos sairiam com o mesmo.
  const linhasIniciais = useMemo(() => {
    const usados = new Set(materiais.map(m => (m.codigo || '').toUpperCase()).filter(Boolean))
    return itens.map(it => {
      const duplicado = jaCadastrado(it.nome, materiais)
      const codigo = codigoSugerido(it.nome, usados)
      usados.add(codigo)
      const categoria = categoriaSugerida(it.nome)
      return {
        nome: it.nome,
        retiradas: it.retiradas,
        duplicado,
        marcado: !duplicado,
        codigo,
        categoria,
        quantidade: 0,
      }
    })
  }, [itens, materiais])

  const [linhas, setLinhas] = useState(linhasIniciais)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function mudar(indice, campo, valor) {
    setLinhas(prev => prev.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)))
  }

  const marcadas = linhas.filter(l => l.marcado)
  const codigosRepetidos = useMemo(() => {
    const vistos = new Set()
    const repetidos = new Set()
    for (const l of marcadas) {
      const c = l.codigo.trim().toUpperCase()
      if (!c) continue
      if (vistos.has(c)) repetidos.add(c)
      vistos.add(c)
    }
    return repetidos
  }, [marcadas])

  async function cadastrar() {
    if (!marcadas.length || salvando) return
    if (marcadas.some(l => !l.codigo.trim())) { setErro('Todo item marcado precisa de código.'); return }
    if (codigosRepetidos.size) { setErro('Há códigos repetidos entre os marcados. Ajuste antes de continuar.'); return }
    setSalvando(true)
    setErro('')
    try {
      for (let i = 0; i < marcadas.length; i += POR_LOTE) {
        const lote = writeBatch(db)
        for (const l of marcadas.slice(i, i + POR_LOTE)) {
          const quantidade = Math.max(0, Number(l.quantidade) || 0)
          lote.set(doc(collection(db, 'materiais')), {
            grupo: 'uso_interno',
            nome: l.nome.trim(),
            codigo: l.codigo.trim().toUpperCase(),
            categoria: l.categoria,
            subcategoria: l.categoria.toLowerCase().replace(/ /g, '_'),
            tipo: TIPOS_POR_CATEGORIA[l.categoria]?.[0] || '',
            bitola: null,
            metragem: null,
            numero: null,
            status: 'disponivel',
            eventoAtual: null,
            estoqueAtual: quantidade,
            estoqueMin: 1,
            observacao: 'Cadastrado a partir dos itens avulsos do Uso Interno.',
            criadoEm: serverTimestamp(),
          })
        }
        await lote.commit()
      }
      onSalvo?.(marcadas.length)
    } catch (e) {
      setErro(e.message || 'Não foi possível cadastrar. Tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-brand-black">Cadastrar no estoque</h2>
          <p className="text-xs text-gray-500 mt-1">
            Estes itens saíram digitados na mão. Cadastrando, eles passam a existir no
            Estoque &rarr; Material Interno, com código e contagem.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {linhas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum item avulso registrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {linhas.map((l, i) => (
                <li
                  key={l.nome + i}
                  className={`rounded-xl border px-3 py-2.5 ${
                    l.duplicado
                      ? 'border-gray-200 dark:border-gray-700 opacity-60'
                      : l.marcado
                        ? 'border-brand-red bg-red-50 dark:bg-red-950/30'
                        : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={l.marcado}
                      disabled={l.duplicado}
                      onChange={e => mudar(i, 'marcado', e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-red focus:ring-brand-red flex-shrink-0 disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-black truncate">{l.nome}</p>
                      <p className="text-xs text-gray-500">
                        {l.duplicado
                          ? 'Já existe um material com esse nome'
                          : `saiu ${l.retiradas} ${l.retiradas === 1 ? 'vez' : 'vezes'}`}
                      </p>
                    </div>
                  </div>

                  {l.marcado && !l.duplicado && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5 pl-7">
                      <label className="block">
                        <span className="text-[11px] text-gray-500 block mb-0.5">Categoria</span>
                        <select
                          value={l.categoria}
                          onChange={e => mudar(i, 'categoria', e.target.value)}
                          className="input py-1.5 text-sm"
                        >
                          {CATEGORIAS_POR_GRUPO.uso_interno.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-gray-500 block mb-0.5">Código</span>
                        <input
                          value={l.codigo}
                          onChange={e => mudar(i, 'codigo', e.target.value.toUpperCase())}
                          className={`input py-1.5 text-sm font-mono ${
                            codigosRepetidos.has(l.codigo.trim().toUpperCase()) ? 'border-brand-red' : ''
                          }`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-gray-500 block mb-0.5">Qtd. na prateleira</span>
                        <input
                          type="number"
                          min="0"
                          value={l.quantidade}
                          onChange={e => mudar(i, 'quantidade', e.target.value)}
                          className="input py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              <b className="text-brand-black">{marcadas.length}</b> para cadastrar
            </p>
            <div className="flex gap-2">
              <button onClick={onFechar} disabled={salvando} className="btn-secondary justify-center">
                Cancelar
              </button>
              <button
                onClick={cadastrar}
                disabled={!marcadas.length || salvando}
                className="btn-primary justify-center disabled:opacity-50"
              >
                {salvando ? 'Cadastrando...' : 'Cadastrar no estoque'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
