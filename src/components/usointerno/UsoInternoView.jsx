import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs, getDoc, deleteDoc, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, formatarDataHora, materialPorQuantidade, statusDevolucaoCor } from '../../utils/formatters'
import { comprimirParaDataUrl } from '../../utils/imagem'
import { gerarRelatorioUsoInterno } from '../../utils/relatorioUsoInterno'
import FotoPickerBotoes from '../ui/FotoPickerBotoes'

const ABAS = ['Ferramentas em Campo', 'Itens Avulsos', 'Histórico']

// Dias de atraso (negativo = ainda no prazo). Base: dataPrevistaDevolucao 'YYYY-MM-DD'.
function diasAtraso(dataPrevista) {
  if (!dataPrevista) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const prev = new Date(dataPrevista + 'T00:00:00')
  return Math.round((hoje - prev) / 86400000)
}

export default function UsoInternoView() {
  const [aba, setAba] = useState('Ferramentas em Campo')
  const { dados: ordens } = useCollection('ordens_saida')

  const emprestimosPendentes = useMemo(() => {
    return ordens
      // Pendentes = ainda não devolvidos. Uma devolução já registrada (devolvido OU
      // parcial) sai da fila — a devolução é um evento único, não se repete.
      .filter(o => o.tipo === 'uso_interno' && o.subtipo === 'emprestimo' && (o.statusEmprestimo || 'pendente') === 'pendente')
      .sort((a, b) => {
        // Mais atrasado primeiro: menor dataPrevistaDevolucao no topo.
        const da = a.dataPrevistaDevolucao || '9999-12-31'
        const dbb = b.dataPrevistaDevolucao || '9999-12-31'
        return da.localeCompare(dbb)
      })
  }, [ordens])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Uso Interno</h1>
        <p className="text-gray-500 text-sm mt-1">Ferramentas emprestadas e itens avulsos que saíram para uso da equipe.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {ABAS.map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-1 pb-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${
              aba === a ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-black'
            }`}
          >
            {a}
            {a === 'Ferramentas em Campo' && emprestimosPendentes.length > 0 && (
              <span className="ml-1.5 text-xs bg-brand-red text-white rounded-full px-1.5 py-0.5">{emprestimosPendentes.length}</span>
            )}
          </button>
        ))}
      </div>

      {aba === 'Ferramentas em Campo' && <FerramentasEmCampo emprestimos={emprestimosPendentes} />}
      {aba === 'Itens Avulsos' && <ItensAvulsos ordens={ordens} />}
      {aba === 'Histórico' && <HistoricoInternas ordens={ordens} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ferramentas em Campo (empréstimos pendentes + devolução)
// ---------------------------------------------------------------------------
function FerramentasEmCampo({ emprestimos }) {
  const [fotosPorOrdem, setFotosPorOrdem] = useState({}) // { ordemId: { saida: [], devolucao: [] } }
  const [devolvendo, setDevolvendo] = useState(null) // ordem em devolução
  const [adicionando, setAdicionando] = useState(null) // ordem recebendo mais itens

  // Carrega fotos (saída/devolução) das ordens visíveis, uma query por ordem.
  useEffect(() => {
    let ativo = true
    async function carregar() {
      const entradas = await Promise.all(emprestimos.map(async o => {
        try {
          const snap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', '==', o.id)))
          const fotos = snap.docs.map(d => d.data())
          return [o.id, {
            saida: fotos.filter(f => (f.momento || 'saida') === 'saida'),
            devolucao: fotos.filter(f => f.momento === 'devolucao'),
          }]
        } catch { return [o.id, { saida: [], devolucao: [] }] }
      }))
      if (ativo) setFotosPorOrdem(Object.fromEntries(entradas))
    }
    if (emprestimos.length > 0) carregar()
    return () => { ativo = false }
  }, [emprestimos])

  if (emprestimos.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
        <p>Nenhuma ferramenta pendente de devolução.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {emprestimos.map(o => {
        const atraso = diasAtraso(o.dataPrevistaDevolucao)
        const atrasado = atraso != null && atraso > 0
        const fotos = fotosPorOrdem[o.id] || { saida: [], devolucao: [] }
        return (
          <div key={o.id} className={`card ${atrasado ? 'border-red-300' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-brand-black">{o.numeroFormatado}</span>
                  {atrasado ? (
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {atraso} {atraso === 1 ? 'dia' : 'dias'} de atraso
                    </span>
                  ) : atraso != null ? (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {atraso === 0 ? 'vence hoje' : `faltam ${-atraso} ${-atraso === 1 ? 'dia' : 'dias'}`}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="text-gray-400">Com:</span> {o.responsavelNome || '—'}
                </p>
                <p className="text-xs text-gray-500">
                  Prevista: {formatarData(o.dataPrevistaDevolucao)}
                  {o.destinoMotivo ? ` · ${o.destinoMotivo}` : ''}
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setAdicionando(o)}
                  className="btn-secondary text-sm py-1.5 px-3 gap-1"
                  title="Adicionar mais itens a este empréstimo"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Itens
                </button>
                <button onClick={() => setDevolvendo(o)} className="btn-primary text-sm py-1.5 px-3">
                  Devolver
                </button>
              </div>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {(o.itens || []).map((it, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                    {it.nome}{it.quantidade > 1 ? ` (${it.quantidade}${it.unidade ? ' ' + it.unidade : ''})` : ''}
                    {it.avulso ? ' •avulso' : ''}
                  </span>
                ))}
              </div>
            </div>

            {(fotos.saida.length > 0 || fotos.devolucao.length > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FotoColuna titulo="Saída" fotos={fotos.saida} />
                <FotoColuna titulo="Devolução" fotos={fotos.devolucao} />
              </div>
            )}
          </div>
        )
      })}

      {devolvendo && (
        <DevolucaoEmprestimoModal
          ordem={devolvendo}
          onFechar={() => setDevolvendo(null)}
        />
      )}

      {adicionando && (
        <AdicionarItensModal
          ordem={adicionando}
          onFechar={() => setAdicionando(null)}
        />
      )}
    </div>
  )
}

// Adiciona mais itens a um empréstimo PENDENTE existente (pessoa que volta pra
// pegar mais no mesmo dia). Atualiza itens da ordem e do doc de assinatura, e
// prende os cadastrados no estoque (status 'emprestado') — mesma lógica do fluxo.
const UNIDADES_AVULSO = ['un', 'm', 'kg', 'l', 'cx']

function AdicionarItensModal({ ordem, onFechar }) {
  const { dados: materiais } = useCollection('materiais')
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState([])
  const [avulsoAberto, setAvulsoAberto] = useState(false)
  const [avulso, setAvulso] = useState({ nome: '', quantidade: 1, unidade: 'un' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const disponiveis = useMemo(() => {
    if (!busca.trim()) return []
    const q = busca.toLowerCase()
    return materiais
      .filter(m => m.status === 'disponivel')
      .filter(m => m.nome?.toLowerCase().includes(q) || m.codigo?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [materiais, busca])

  function addCadastrado(m) {
    if (itens.some(i => i.id === m.id)) return
    setItens(prev => [...prev, materialPorQuantidade(m) ? { ...m, quantidade: 1 } : m])
    setBusca('')
  }

  function addAvulso() {
    if (!avulso.nome.trim()) return
    setItens(prev => [...prev, {
      avulso: true,
      tempId: String(Date.now() + Math.random()),
      nome: avulso.nome.trim(),
      quantidade: Math.max(1, Number(avulso.quantidade) || 1),
      unidade: avulso.unidade,
    }])
    setAvulso({ nome: '', quantidade: 1, unidade: 'un' })
    setAvulsoAberto(false)
  }

  function remover(chave) {
    setItens(prev => prev.filter(i => (i.avulso ? i.tempId : i.id) !== chave))
  }

  async function confirmar() {
    if (itens.length === 0) return
    setSalvando(true)
    setErro('')
    try {
      await runTransaction(db, async (tx) => {
        // ===== LEITURAS =====
        const ordemRef = doc(db, 'ordens_saida', ordem.id)
        const ordemSnap = await tx.get(ordemRef)
        if (!ordemSnap.exists()) throw new Error('Este empréstimo não existe mais.')
        const dados = ordemSnap.data()
        let assRef = null
        let assDados = null
        if (dados.tokenAssinatura) {
          assRef = doc(db, 'assinaturas_saida', dados.tokenAssinatura)
          const aSnap = await tx.get(assRef)
          assDados = aSnap.exists() ? aSnap.data() : null
        }
        const cadastrados = itens.filter(it => !it.avulso && !materialPorQuantidade(it))
        for (const it of cadastrados) {
          const snap = await tx.get(doc(db, 'materiais', it.id))
          if (!snap.exists()) throw new Error(`Material ${it.nome} não encontrado.`)
          if (snap.data().status !== 'disponivel') throw new Error(`${it.nome} não está mais disponível.`)
        }

        // ===== ESCRITAS =====
        const novos = itens.map(it => it.avulso
          ? { avulso: true, id: null, codigo: null, nome: it.nome, quantidade: it.quantidade || 1, unidade: it.unidade || 'un' }
          : {
            id: it.id,
            nome: it.nome || null,
            codigo: it.codigo || null,
            categoria: it.categoria || null,
            ...(materialPorQuantidade(it) ? { quantidade: it.quantidade || 1 } : {}),
          })
        tx.update(ordemRef, { itens: [...(dados.itens || []), ...novos] })
        if (assRef && assDados) {
          tx.update(assRef, {
            itens: [...(assDados.itens || []), ...itens.map(it => ({
              nome: it.nome || null,
              codigo: it.codigo || null,
              ...((it.avulso || materialPorQuantidade(it)) ? { quantidade: it.quantidade || 1 } : {}),
            }))],
          })
        }
        for (const it of cadastrados) {
          tx.update(doc(db, 'materiais', it.id), { status: 'emprestado', eventoAtual: null, estoqueAtual: 0 })
        }
      })
      onFechar()
    } catch (e) {
      console.error(e)
      const detalhe = e?.code ? `${e.message} (${e.code})` : e?.message
      setErro(detalhe || 'Erro ao adicionar itens.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Adicionar itens</h2>
            <p className="text-xs text-gray-500">{ordem.numeroFormatado} · {ordem.responsavelNome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="relative">
            <input
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar material cadastrado por nome ou código..."
              className="input"
            />
            {disponiveis.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {disponiveis.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addCadastrado(m)}
                    disabled={itens.some(i => i.id === m.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 disabled:opacity-40"
                  >
                    <span className="text-sm text-brand-black truncate">{m.nome}</span>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{m.codigo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {avulsoAberto ? (
            <div className="border border-gray-200 rounded-xl p-3 space-y-3">
              <input
                value={avulso.nome}
                onChange={e => setAvulso(p => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do item (ex: Broca 8mm)"
                className="input"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" min="1"
                  value={avulso.quantidade}
                  onChange={e => setAvulso(p => ({ ...p, quantidade: e.target.value }))}
                  className="input"
                />
                <select
                  value={avulso.unidade}
                  onChange={e => setAvulso(p => ({ ...p, unidade: e.target.value }))}
                  className="input"
                >
                  {UNIDADES_AVULSO.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAvulsoAberto(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={addAvulso} disabled={!avulso.nome.trim()} className="btn-primary flex-1 text-sm disabled:opacity-50">Adicionar avulso</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAvulsoAberto(true)} className="text-xs font-semibold text-brand-red hover:underline inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Item não cadastrado
            </button>
          )}

          {itens.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">Busque um material ou adicione um item avulso.</p>
          ) : (
            <div className="space-y-2">
              {itens.map(it => {
                const chave = it.avulso ? it.tempId : it.id
                return (
                  <div key={chave} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-black truncate">
                        {it.nome}
                        {it.avulso && <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">avulso</span>}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{it.avulso ? `${it.quantidade} ${it.unidade}` : it.codigo}</p>
                    </div>
                    <button onClick={() => remover(chave)} className="text-gray-400 hover:text-brand-red flex-shrink-0" aria-label="Remover item">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{erro}</div>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onFechar} disabled={salvando} className="btn-secondary">Cancelar</button>
          <button
            onClick={confirmar}
            disabled={salvando || itens.length === 0}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : `Adicionar ${itens.length > 0 ? `${itens.length} ` : ''}à ${ordem.numeroFormatado}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function FotoColuna({ titulo, fotos }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{titulo}</p>
      {fotos.length === 0 ? (
        <div className="aspect-video rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">—</div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {fotos.map((f, i) => (
            <img key={i} src={f.dataUrl} alt={`${titulo} ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
          ))}
        </div>
      )}
    </div>
  )
}

const OPCOES_DEV = [
  { valor: 'ok', label: 'Devolvido OK' },
  { valor: 'problema', label: 'Com problema' },
  { valor: 'nao_devolvido', label: 'Não devolvido' },
]

function DevolucaoEmprestimoModal({ ordem, onFechar }) {
  const { uid, nome } = useAuth()
  const itens = ordem.itens || []
  const [statusItens, setStatusItens] = useState(() => itens.map(() => 'ok'))
  const [descricoes, setDescricoes] = useState(() => itens.map(() => ''))
  const [fotos, setFotos] = useState([]) // { file, preview }
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.preview)), [fotos])

  function setStatus(i, v) { setStatusItens(prev => prev.map((s, idx) => idx === i ? v : s)) }
  function setDesc(i, v) { setDescricoes(prev => prev.map((s, idx) => idx === i ? v : s)) }

  function adicionarFotos(arquivos) {
    if (!arquivos?.length) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }

  const podeConfirmar = itens.every((_, i) => {
    const s = statusItens[i]
    if ((s === 'problema' || s === 'nao_devolvido') && !descricoes[i]?.trim()) return false
    return true
  })

  async function confirmar() {
    if (!podeConfirmar) { setErro('Descreva o problema nos itens marcados.'); return }
    setSalvando(true); setErro('')
    try {
      // Fotos de devolução primeiro (base64 em fotos_saida, momento 'devolucao').
      for (let i = 0; i < fotos.length; i++) {
        const dataUrl = await comprimirParaDataUrl(fotos[i].file)
        await addDoc(collection(db, 'fotos_saida'), {
          ordemId: ordem.id, ordem: i, dataUrl, momento: 'devolucao',
          criadoPor: uid, criadoPorNome: nome, criadoEm: serverTimestamp(),
        })
      }

      await runTransaction(db, async (tx) => {
        // LEITURAS: materiais cadastrados (itens com id, não por-quantidade).
        const cadastrados = itens
          .map((it, i) => ({ it, i }))
          .filter(({ it }) => it.id && !materialPorQuantidade(it))
        const existentes = {}
        for (const { it } of cadastrados) {
          const snap = await tx.get(doc(db, 'materiais', it.id))
          existentes[it.id] = snap.exists()
        }

        // ESCRITAS: bloco devolucao no próprio doc da ordem.
        const itensDev = itens.map((it, i) => ({
          id: it.id || null,
          nome: it.nome || null,
          statusDevolucao: statusItens[i],
          descricao: descricoes[i]?.trim() || null,
        }))
        const algumPendente = itensDev.some(d => d.statusDevolucao === 'nao_devolvido')
        tx.update(doc(db, 'ordens_saida', ordem.id), {
          statusEmprestimo: algumPendente ? 'parcial' : 'devolvido',
          devolucao: {
            em: serverTimestamp(),
            operadorUid: uid || null,
            operadorNome: nome || null,
            itens: itensDev,
            qtdFotos: fotos.length,
          },
        })

        // Transições de estoque (mesma lógica da devolução de Evento).
        for (const { it, i } of cadastrados) {
          if (!existentes[it.id]) continue
          const s = statusItens[i]
          const ref = doc(db, 'materiais', it.id)
          if (s === 'ok') tx.update(ref, { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
          else if (s === 'problema') tx.update(ref, { status: 'manutencao', eventoAtual: null })
          else if (s === 'nao_devolvido') tx.update(ref, { status: 'perdido', eventoAtual: null })
        }
      })

      onFechar()
    } catch (err) {
      console.error(err)
      const detalhe = err?.code ? `${err.message} (${err.code})` : err?.message
      setErro(detalhe || 'Erro ao registrar devolução.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Devolver empréstimo</h2>
            <p className="text-xs text-gray-500">{ordem.numeroFormatado} · {ordem.responsavelNome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {itens.map((it, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-3">
              <p className="text-sm font-medium text-brand-black">
                {it.nome}{it.avulso ? <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">avulso</span> : ''}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {OPCOES_DEV.map(op => (
                  <button
                    key={op.valor}
                    onClick={() => setStatus(i, op.valor)}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-colors ${
                      statusItens[i] === op.valor ? `${statusDevolucaoCor(op.valor)} border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              {(statusItens[i] === 'problema' || statusItens[i] === 'nao_devolvido') && (
                <input
                  value={descricoes[i]}
                  onChange={e => setDesc(i, e.target.value)}
                  placeholder={statusItens[i] === 'problema' ? 'Qual o problema?' : 'O que aconteceu?'}
                  className="input mt-2 text-sm"
                />
              )}
            </div>
          ))}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              {fotos.length > 0 ? `Fotos da devolução (${fotos.length})` : 'Foto da devolução (opcional)'}
            </p>
            <FotoPickerBotoes onArquivos={adicionarFotos} disabled={salvando} />
            {fotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {fotos.map((f, idx) => (
                  <img key={idx} src={f.preview} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            )}
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{erro}</div>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onFechar} className="btn-secondary">Cancelar</button>
          <button onClick={confirmar} disabled={salvando || !podeConfirmar} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Confirmar devolução'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Itens Avulsos pendentes de cadastro (agrupados por nome, por frequência)
// ---------------------------------------------------------------------------
function ItensAvulsos({ ordens }) {
  const [fotosView, setFotosView] = useState(null) // { nome, fotos: [] }
  const [carregandoFotos, setCarregandoFotos] = useState(false)

  const agrupados = useMemo(() => {
    const mapa = new Map()
    ordens.forEach(o => {
      (o.itens || []).forEach(it => {
        if (!it.avulso) return
        const chave = (it.nome || '').trim().toLowerCase()
        if (!chave) return
        const atual = mapa.get(chave) || {
          nome: it.nome, retiradas: 0, quantidadeTotal: 0, unidade: it.unidade || 'un',
          ultimaData: o.criadoEm, ultimoResponsavel: o.responsavelNome, ordemIds: [],
        }
        atual.retiradas += 1
        atual.quantidadeTotal += Number(it.quantidade) || 1
        atual.ordemIds.push(o.id)
        const ts = o.criadoEm?.seconds || 0
        const tsAtual = atual.ultimaData?.seconds || 0
        if (ts >= tsAtual) { atual.ultimaData = o.criadoEm; atual.ultimoResponsavel = o.responsavelNome }
        mapa.set(chave, atual)
      })
    })
    return Array.from(mapa.values()).sort((a, b) => b.retiradas - a.retiradas)
  }, [ordens])

  async function verFotos(item) {
    setCarregandoFotos(true)
    setFotosView({ nome: item.nome, fotos: [] })
    try {
      const todas = []
      for (const oid of item.ordemIds.slice(0, 10)) {
        const snap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', '==', oid)))
        snap.docs.forEach(d => { const f = d.data(); if ((f.momento || 'saida') === 'saida') todas.push(f.dataUrl) })
      }
      setFotosView({ nome: item.nome, fotos: todas })
    } catch {
      setFotosView({ nome: item.nome, fotos: [] })
    } finally {
      setCarregandoFotos(false)
    }
  }

  if (agrupados.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <p>Nenhum item avulso registrado ainda.</p>
        <p className="text-xs mt-1">Itens "não cadastrados" das saídas internas aparecem aqui, para você decidir quais viram cadastro oficial.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Ordenado pelos que mais saem — priorize cadastrar os do topo.</p>
      {agrupados.map((item, i) => (
        <div key={i} className="card flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-red/10 text-brand-red font-bold flex items-center justify-center flex-shrink-0">
            {item.retiradas}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-black truncate">{item.nome}</p>
            <p className="text-xs text-gray-500">
              {item.retiradas} {item.retiradas === 1 ? 'retirada' : 'retiradas'} · {item.quantidadeTotal} {item.unidade} no total
              {item.ultimoResponsavel ? ` · última: ${item.ultimoResponsavel}` : ''}
            </p>
          </div>
          <button onClick={() => verFotos(item)} className="text-xs font-semibold text-brand-red hover:underline flex-shrink-0">
            Ver fotos
          </button>
        </div>
      ))}

      {fotosView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFotosView(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-brand-black">{fotosView.nome}</h3>
              <button onClick={() => setFotosView(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {carregandoFotos ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
            ) : fotosView.fotos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma foto registrada nas saídas deste item.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {fotosView.fotos.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Histórico de saídas internas (empréstimo + consumo): relatório e exclusão
// ---------------------------------------------------------------------------
function HistoricoInternas({ ordens }) {
  const [excluindo, setExcluindo] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  const internas = useMemo(() =>
    ordens
      .filter(o => o.tipo === 'uso_interno')
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0)),
    [ordens])

  // Relatório: busca o doc de assinatura (imagens de quem entregou/recebeu) e as
  // fotos da ordem, e imprime.
  async function imprimir(o) {
    let ass = null
    if (o.tokenAssinatura) {
      try {
        const snap = await getDoc(doc(db, 'assinaturas_saida', o.tokenAssinatura))
        if (snap.exists()) ass = snap.data()
      } catch { /* sem assinatura: imprime com linhas em branco */ }
    }
    let fotosOrdem = []
    try {
      const fsnap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', '==', o.id)))
      fotosOrdem = fsnap.docs.map(d => d.data()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    } catch (e) { console.error(e) }
    gerarRelatorioUsoInterno(o, ass, fotosOrdem)
  }

  // Exclusão: apaga a ordem e devolve ao estoque os itens que AINDA estão presos por
  // ela (status emprestado/consumido). Itens já devolvidos/transicionados não são
  // tocados. Apaga também o doc de assinatura e as fotos da ordem.
  async function confirmarExclusao() {
    const ordem = excluindo
    if (!ordem) return
    setProcessando(true)
    setErro('')
    try {
      await runTransaction(db, async (tx) => {
        // ===== LEITURAS =====
        const cadastrados = (ordem.itens || []).filter(it => it.id && !materialPorQuantidade(it))
        const snaps = []
        for (const it of cadastrados) {
          snaps.push([it, await tx.get(doc(db, 'materiais', it.id))])
        }
        // ===== ESCRITAS =====
        tx.delete(doc(db, 'ordens_saida', ordem.id))
        if (ordem.tokenAssinatura) tx.delete(doc(db, 'assinaturas_saida', ordem.tokenAssinatura))
        const esperado = ordem.subtipo === 'consumo' ? 'consumido' : 'emprestado'
        for (const [it, snap] of snaps) {
          if (snap.exists() && snap.data().status === esperado) {
            tx.update(doc(db, 'materiais', it.id), { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
          }
        }
      })
      // Fotos fora da transaction (não bloqueiam a exclusão se falharem).
      try {
        const fs = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', '==', ordem.id)))
        await Promise.all(fs.docs.map(d => deleteDoc(d.ref)))
      } catch (e) { console.error(e) }
      setExcluindo(null)
    } catch (e) {
      console.error(e)
      setErro(e.message || 'Erro ao excluir o lançamento.')
    } finally {
      setProcessando(false)
    }
  }

  if (internas.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <p>Nenhuma saída interna registrada ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {internas.map(o => (
        <div key={o.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-brand-black">{o.numeroFormatado}</span>
                <span className={`badge ${o.subtipo === 'emprestimo' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                  {o.subtipo === 'emprestimo' ? 'Empréstimo' : 'Consumo'}
                </span>
                {o.subtipo === 'emprestimo' && (
                  <span className={`badge ${o.statusEmprestimo === 'devolvido' ? 'bg-green-100 text-green-700' : o.statusEmprestimo === 'parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                    {o.statusEmprestimo === 'devolvido' ? 'Devolvido' : o.statusEmprestimo === 'parcial' ? 'Parcial' : 'Pendente'}
                  </span>
                )}
                {o.tokenAssinatura && (
                  <span className={`badge ${o.assinaturaStatus === 'assinada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {o.assinaturaStatus === 'assinada' ? 'Assinada' : 'Assinatura pendente'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                <span className="text-gray-400">Responsável:</span> {o.responsavelNome || '—'}
                {o.motivo ? ` · ${o.motivo}` : ''}
              </p>
              <p className="text-xs text-gray-400">
                {formatarDataHora(o.criadoEm)} · {(o.itens || []).length} {(o.itens || []).length === 1 ? 'item' : 'itens'}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => imprimir(o)}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-brand-red hover:text-brand-red transition-colors"
                title="Imprimir relatório"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
              <button
                onClick={() => { setErro(''); setExcluindo(o) }}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-brand-red hover:text-brand-red hover:bg-red-50 transition-colors"
                title="Excluir lançamento"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      {excluindo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div>
              <p className="font-semibold text-brand-black">Excluir lançamento</p>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{excluindo.numeroFormatado}</strong> — {excluindo.responsavelNome || '—'}.
                Os itens que ainda estiverem {excluindo.subtipo === 'consumo' ? 'consumidos' : 'emprestados'} por
                esta saída voltam ao estoque como disponíveis. Fotos e link de assinatura serão apagados.
              </p>
            </div>
            {erro && <p className="text-sm text-brand-red">{erro}</p>}
            <div className="flex gap-3">
              <button onClick={() => setExcluindo(null)} disabled={processando} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={confirmarExclusao}
                disabled={processando}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {processando ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
