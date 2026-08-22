import { useState, useMemo } from 'react'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { GRUPOS, grupoDoMaterial } from './categorias'
import { pareceUsoInterno } from './sugestaoGrupo'
import { statusMaterialLabel } from '../../utils/formatters'

// Mover materiais de um grupo para o outro, em lote.
//
// O grupo "Material Interno" nasceu depois do estoque, então fita, parafuso e
// EPI ficaram no grupo de eventos. Mover um por um pela edição seria inviável.
// A tela PRÉ-MARCA o que parece uso interno, mas quem confirma é o usuário:
// nada muda sozinho.
//
// Só o campo `grupo` é alterado. Status, quantidade e evento atual ficam
// intactos — mover de grupo é organização de prateleira, não movimentação de
// estoque. Por isso também é reversível: é só mover de volta.

const POR_LOTE = 400 // o writeBatch do Firestore aceita até 500 operações

export default function MoverGrupoModal({ materiais, origem, onFechar, onSalvo }) {
  const destino = origem === 'uso_interno' ? 'eventos' : 'uso_interno'
  const rotulo = g => GRUPOS.find(x => x.value === g)?.label || g

  const candidatos = useMemo(
    () => materiais
      .filter(m => grupoDoMaterial(m) === origem)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    [materiais, origem],
  )

  // Pré-marcação só faz sentido indo para o Material Interno; no caminho
  // inverso (trazendo de volta) o usuário escolhe do zero.
  const [marcados, setMarcados] = useState(() => new Set(
    destino === 'uso_interno' ? candidatos.filter(pareceUsoInterno).map(m => m.id) : [],
  ))
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return candidatos
    return candidatos.filter(m =>
      m.nome?.toLowerCase().includes(q)
      || m.codigo?.toLowerCase().includes(q)
      || m.categoria?.toLowerCase().includes(q)
      || m.tipo?.toLowerCase().includes(q))
  }, [candidatos, busca])

  function alternar(id) {
    setMarcados(prev => {
      const proximo = new Set(prev)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  // Marca/desmarca só o que está na tela agora, para a busca servir de seleção.
  function marcarVisiveis(valor) {
    setMarcados(prev => {
      const proximo = new Set(prev)
      for (const m of visiveis) {
        if (valor) proximo.add(m.id)
        else proximo.delete(m.id)
      }
      return proximo
    })
  }

  async function mover() {
    if (!marcados.size || salvando) return
    setSalvando(true)
    setErro('')
    try {
      const ids = [...marcados]
      for (let i = 0; i < ids.length; i += POR_LOTE) {
        const lote = writeBatch(db)
        for (const id of ids.slice(i, i + POR_LOTE)) {
          lote.update(doc(db, 'materiais', id), { grupo: destino })
        }
        await lote.commit()
      }
      onSalvo?.(ids.length, destino)
    } catch (e) {
      setErro(e.message || 'Não foi possível mover os materiais. Tente de novo.')
      setSalvando(false)
    }
  }

  const marcadosVisiveis = visiveis.filter(m => marcados.has(m.id)).length
  const todosVisiveisMarcados = visiveis.length > 0 && marcadosVisiveis === visiveis.length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-brand-black">Mover para {rotulo(destino)}</h2>
          <p className="text-xs text-gray-500 mt-1">
            Saindo de {rotulo(origem)}. Muda só a prateleira: status, quantidade e evento
            do material continuam como estão, e dá para mover de volta depois.
          </p>
        </div>

        <div className="px-5 py-3 space-y-3 border-b border-gray-100 dark:border-gray-800">
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, código, categoria ou tipo..."
            className="input"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => marcarVisiveis(!todosVisiveisMarcados)}
              className="text-xs font-semibold text-brand-red hover:underline"
            >
              {todosVisiveisMarcados ? 'Desmarcar os que aparecem' : 'Marcar todos os que aparecem'}
            </button>
            <p className="text-xs text-gray-500">
              <b className="text-brand-black">{marcados.size}</b> marcado{marcados.size === 1 ? '' : 's'}
              {busca && ` · ${visiveis.length} na busca`}
            </p>
          </div>
          {destino === 'uso_interno' && !busca && (
            <p className="text-xs rounded-xl px-3 py-2 border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              Já deixei marcado o que parece material interno (fita, parafuso, EPI, ferramenta).
              Confira e ajuste antes de confirmar.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {visiveis.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhum material em {rotulo(origem)} com esse texto.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visiveis.map(m => {
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
                        <p className="text-xs text-gray-500 truncate">
                          {[m.categoria, m.tipo].filter(Boolean).join(' · ') || 'sem categoria'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono text-gray-400">{m.codigo}</p>
                        <p className="text-xs text-gray-500">{statusMaterialLabel(m.status)}</p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-2">
            <button onClick={onFechar} disabled={salvando} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button
              onClick={mover}
              disabled={!marcados.size || salvando}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {salvando ? 'Movendo...' : `Mover ${marcados.size || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
