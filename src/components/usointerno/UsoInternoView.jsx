import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, materialPorQuantidade, statusDevolucaoCor } from '../../utils/formatters'
import { comprimirParaDataUrl } from '../../utils/imagem'

const ABAS = ['Ferramentas em Campo', 'Itens Avulsos']

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
      .filter(o => o.tipo === 'uso_interno' && o.subtipo === 'emprestimo' && o.statusEmprestimo !== 'devolvido')
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

      {aba === 'Ferramentas em Campo'
        ? <FerramentasEmCampo emprestimos={emprestimosPendentes} />
        : <ItensAvulsos ordens={ordens} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ferramentas em Campo (empréstimos pendentes + devolução)
// ---------------------------------------------------------------------------
function FerramentasEmCampo({ emprestimos }) {
  const [fotosPorOrdem, setFotosPorOrdem] = useState({}) // { ordemId: { saida: [], devolucao: [] } }
  const [devolvendo, setDevolvendo] = useState(null) // ordem em devolução

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
              <button onClick={() => setDevolvendo(o)} className="btn-primary flex-shrink-0 text-sm py-1.5 px-3">
                Devolver
              </button>
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

  function adicionarFotos(e) {
    const arquivos = Array.from(e.target.files || [])
    if (arquivos.length === 0) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
    e.target.value = ''
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
            <label className="btn-secondary w-full justify-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {fotos.length > 0 ? `Fotos da devolução (${fotos.length})` : 'Foto da devolução (opcional)'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={adicionarFotos} />
            </label>
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
