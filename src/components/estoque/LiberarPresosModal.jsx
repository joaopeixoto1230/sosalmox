import { useState, useMemo } from 'react'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { materiaisPresos } from '../devolucao/buscaDevolucao'
import { materialContado } from './contagem'

// Liberar material PRESO em evento.
//
// Material fica "em_evento" apontando para um evento que já acabou, foi
// excluído, ou sem vínculo nenhum. Ele some das telas de devolução e nunca
// volta ao estoque sozinho — o almoxarifado conta um item que o sistema jura
// estar na rua.
//
// A causa foi corrigida (a devolução agora enxerga material fora das ordens, e
// a troca de status devolve o estoque), mas o que já bagunçou precisa de
// conserto manual. Esta tela mostra o que está preso, o MOTIVO de cada um, e
// libera só o que o usuário confirmar.

const POR_LOTE = 400 // writeBatch do Firestore aceita até 500 operações

export default function LiberarPresosModal({ materiais, eventos, onFechar, onSalvo }) {
  const presos = useMemo(
    () => materiaisPresos(materiais, eventos)
      .sort((a, b) => (a.material.nome || '').localeCompare(b.material.nome || '')),
    [materiais, eventos],
  )

  const [marcados, setMarcados] = useState(() => new Set(presos.map(p => p.material.id)))
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return presos
    return presos.filter(({ material: m }) =>
      m.nome?.toLowerCase().includes(q) || m.codigo?.toLowerCase().includes(q))
  }, [presos, busca])

  function alternar(id) {
    setMarcados(prev => {
      const proximo = new Set(prev)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  function marcarVisiveis(valor) {
    setMarcados(prev => {
      const proximo = new Set(prev)
      for (const { material } of visiveis) {
        if (valor) proximo.add(material.id)
        else proximo.delete(material.id)
      }
      return proximo
    })
  }

  async function liberar() {
    if (!marcados.size || salvando) return
    setSalvando(true)
    setErro('')
    try {
      const alvos = presos.filter(p => marcados.has(p.material.id))
      for (let i = 0; i < alvos.length; i += POR_LOTE) {
        const lote = writeBatch(db)
        for (const { material } of alvos.slice(i, i + POR_LOTE)) {
          // Volta para a prateleira exatamente como a devolução faria: solta o
          // evento e devolve a unidade. Contado tem quantidade própria.
          lote.update(doc(db, 'materiais', material.id), {
            status: 'disponivel',
            eventoAtual: null,
            ...(materialContado(material) ? {} : { estoqueAtual: 1 }),
          })
        }
        await lote.commit()
      }
      onSalvo?.(alvos.length)
    } catch (e) {
      setErro(e.message || 'Não foi possível liberar. Tente de novo.')
      setSalvando(false)
    }
  }

  const marcadosVisiveis = visiveis.filter(p => marcados.has(p.material.id)).length
  const todosMarcados = visiveis.length > 0 && marcadosVisiveis === visiveis.length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-brand-black">Material preso em evento</h2>
          <p className="text-xs text-gray-500 mt-1">
            Estes itens estão marcados como "Em Evento", mas o evento já acabou, foi excluído
            ou não existe mais. Liberar devolve cada um à prateleira, como uma devolução faria.
          </p>
        </div>

        {presos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-500">
              Nenhum material preso. Todo item "Em Evento" está num evento que continua ativo.
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 space-y-3 border-b border-gray-100 dark:border-gray-800">
              <input
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou código..."
                className="input"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => marcarVisiveis(!todosMarcados)}
                  className="text-xs font-semibold text-brand-red hover:underline min-h-[40px]"
                >
                  {todosMarcados ? 'Desmarcar os que aparecem' : 'Marcar todos os que aparecem'}
                </button>
                <p className="text-xs text-gray-500">
                  <b className="text-brand-black">{marcados.size}</b> de {presos.length} para liberar
                </p>
              </div>
              <p className="text-xs rounded-xl px-3 py-2 border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Confira antes: se algum destes ainda está de fato na rua, desmarque. Liberar diz
                ao sistema que o item voltou.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {visiveis.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nada com esse texto.</p>
              ) : (
                <ul className="space-y-1.5">
                  {visiveis.map(({ material: m, motivo }) => {
                    const marcado = marcados.has(m.id)
                    return (
                      <li key={m.id}>
                        <label className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer border transition-colors
                          ${marcado
                            ? 'border-brand-red bg-red-50 dark:bg-red-950/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternar(m.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-red focus:ring-brand-red flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-brand-black truncate">{m.nome}</p>
                            <p className="text-xs text-gray-500 truncate">{motivo}</p>
                          </div>
                          <p className="text-xs font-mono text-gray-400 flex-shrink-0">{m.codigo}</p>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-2">
            <button onClick={onFechar} disabled={salvando} className="btn-secondary flex-1 justify-center">
              {presos.length === 0 ? 'Fechar' : 'Cancelar'}
            </button>
            {presos.length > 0 && (
              <button
                onClick={liberar}
                disabled={!marcados.size || salvando}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {salvando ? 'Liberando...' : `Liberar ${marcados.size || ''}`.trim()}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
