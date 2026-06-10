import { useState, useMemo } from 'react'
import { doc, runTransaction, collection, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarNumeroOS } from '../../utils/formatters'
import { criarSolicitacaoCompra } from '../../utils/notificacoes'

export default function SaidaFiltrosModal({ onFechar }) {
  const { uid, nome } = useAuth()
  const { dados: geradores } = useCollection('geradores')
  const { dados: filtros } = useCollection('filtros')

  const [passo, setPasso] = useState(1)
  const [form, setForm] = useState({
    equipamentoTipo: 'gerador',
    equipamentoId: '',
    equipamentoLabel: '',
    tipo: 'preventiva',
    descricao: '',
    horimetroAbertura: '',
    mecanico: '',
  })
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [buscaFiltro, setBuscaFiltro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  const geradoresAtivos = useMemo(
    () => geradores.filter(g => g.ativo !== false && g.status !== 'inativo'),
    [geradores]
  )

  const filtrosDisponiveis = useMemo(() => {
    return filtros
      .filter(f => f.ativo !== false)
      .filter(f => {
        if (!buscaFiltro) return true
        const q = buscaFiltro.toLowerCase()
        return (
          f.nome?.toLowerCase().includes(q) ||
          f.referencia?.toLowerCase().includes(q) ||
          f.potenciaGG?.toLowerCase().includes(q)
        )
      })
  }, [filtros, buscaFiltro])

  const agrupados = useMemo(() => {
    const map = new Map()
    filtrosDisponiveis.forEach(f => {
      const key = f.potenciaGG || 'Outros'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(f)
    })
    return Array.from(map.entries()).sort(([a], [b]) => (parseInt(a) || 9999) - (parseInt(b) || 9999))
  }, [filtrosDisponiveis])

  function selecionarGerador(g) {
    set('equipamentoId', g.id)
    set('equipamentoLabel', `${g.codigo} — ${g.potencia || ''} ${g.marca || ''}`.trim())
  }

  function adicionarFiltro(filtro) {
    if (itensSelecionados.some(i => i.filtro.id === filtro.id)) return
    setItensSelecionados(prev => [...prev, { filtro, quantidade: 1 }])
  }

  function removerFiltro(filtroId) {
    setItensSelecionados(prev => prev.filter(i => i.filtro.id !== filtroId))
  }

  function setQuantidade(filtroId, qtd) {
    setItensSelecionados(prev =>
      prev.map(i => i.filtro.id === filtroId ? { ...i, quantidade: Math.max(1, qtd) } : i)
    )
  }

  function avancar() {
    if (!form.equipamentoLabel) { setErro('Selecione um equipamento.'); return }
    if (!form.descricao.trim()) { setErro('Descreva o serviço.'); return }
    if (!form.mecanico) { setErro('Selecione quem está retirando os filtros.'); return }
    setErro('')
    setPasso(2)
  }

  async function confirmar() {
    if (itensSelecionados.length === 0) { setErro('Adicione ao menos um filtro.'); return }
    setSalvando(true); setErro('')
    try {
      const isGG = form.equipamentoTipo === 'gerador' && form.equipamentoId
      let eventoAtivo = false
      if (isGG) {
        const snap = await getDoc(doc(db, 'geradores', form.equipamentoId))
        eventoAtivo = snap.data()?.status === 'em_evento'
      }

      let osNumero = ''
      const filtrosAtualizados = []

      await runTransaction(db, async (tx) => {
        // ── TODAS AS LEITURAS PRIMEIRO ──
        const contRef = doc(db, 'contadores', 'ordens_servico')
        const contSnap = await tx.get(contRef)

        const filtroRefs = itensSelecionados.map(i => doc(db, 'filtros', i.filtro.id))
        const filtroSnaps = await Promise.all(filtroRefs.map(r => tx.get(r)))

        // ── CÁLCULOS ──
        const ultimo = contSnap.exists() ? (contSnap.data().ultimo || 0) : 0
        const proximo = ultimo + 1
        osNumero = formatarNumeroOS(proximo)

        const novasQtds = filtroSnaps.map((snap, idx) => {
          const atual = snap.data()?.quantidadeAtual || 0
          return atual - itensSelecionados[idx].quantidade
        })

        const filtrosUsados = itensSelecionados.map(i => ({
          filtroId: i.filtro.id,
          filtroNome: i.filtro.nome,
          quantidade: i.quantidade,
          potenciaGG: i.filtro.potenciaGG || '',
        }))

        // ── TODAS AS ESCRITAS DEPOIS ──
        tx.set(contRef, { ultimo: proximo }, { merge: true })

        const osRef = doc(collection(db, 'ordens_servico'))
        tx.set(osRef, {
          numero: osNumero,
          equipamentoId: form.equipamentoId,
          equipamentoTipo: form.equipamentoTipo,
          equipamentoLabel: form.equipamentoLabel,
          tipo: form.tipo,
          descricao: form.descricao,
          horimetroAbertura: form.horimetroAbertura ? parseInt(form.horimetroAbertura) : null,
          observacoes: '',
          mecanicoUid: null,
          mecanicoNome: form.mecanico,
          status: 'em_andamento',
          prioridade: eventoAtivo ? 'maxima' : 'normal',
          eventoAtivo,
          filtrosUsados,
          origem: 'saida_filtros',
          almoxarifeUid: uid,
          almoxarifeNome: nome,
          dataAbertura: serverTimestamp(),
          criadoEm: serverTimestamp(),
        })

        itensSelecionados.forEach((item, idx) => {
          tx.update(filtroRefs[idx], { quantidadeAtual: novasQtds[idx] })

          const baixaRef = doc(collection(db, 'baixas_filtro'))
          tx.set(baixaRef, {
            filtroId: item.filtro.id,
            filtroNome: item.filtro.nome,
            potenciaGG: item.filtro.potenciaGG || '',
            quantidade: item.quantidade,
            motivo: `Manutenção ${form.tipo} — ${form.equipamentoLabel}`,
            ordemServicoNumero: osNumero,
            equipamentoLabel: form.equipamentoLabel,
            retiradoPor: form.mecanico,
            operadorUid: uid,
            operadorNome: nome,
            criadoEm: serverTimestamp(),
          })

          filtrosAtualizados.push({ ...item.filtro, quantidadeAtual: novasQtds[idx] })
        })

        if (isGG) {
          tx.update(doc(db, 'geradores', form.equipamentoId), {
            status: 'manutencao',
            localizacao: 'Em manutenção',
          })
        }
      })

      for (const f of filtrosAtualizados) {
        if ((f.estoqueMin || 0) > 0 && f.quantidadeAtual <= f.estoqueMin) {
          await criarSolicitacaoCompra(f).catch(() => {})
        }
      }

      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao registrar saída.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Saída para Manutenção</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${passo >= 1 ? 'bg-brand-red' : 'bg-gray-200'}`} />
              <div className={`w-8 h-0.5 ${passo >= 2 ? 'bg-brand-red' : 'bg-gray-200'}`} />
              <div className={`w-2 h-2 rounded-full ${passo >= 2 ? 'bg-brand-red' : 'bg-gray-200'}`} />
              <span className="text-xs text-gray-400 ml-1">{passo === 1 ? 'Equipamento' : 'Filtros'}</span>
            </div>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {passo === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de equipamento</label>
                <div className="flex gap-2">
                  {[['gerador', 'Gerador (GG)'], ['caminhao', 'Caminhão'], ['empilhadeira', 'Empilhadeira']].map(([val, label]) => (
                    <button key={val}
                      onClick={() => { set('equipamentoTipo', val); set('equipamentoId', ''); set('equipamentoLabel', '') }}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                        ${form.equipamentoTipo === val ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.equipamentoTipo === 'gerador' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Gerador *</label>
                  <div className="max-h-44 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                    {geradoresAtivos.map(g => (
                      <button key={g.id} onClick={() => selecionarGerador(g)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                          ${form.equipamentoId === g.id ? 'bg-brand-red text-white' : 'hover:bg-gray-50'}`}>
                        <span className="font-semibold">{g.codigo}</span>
                        <span className="ml-2 opacity-70">{g.potencia} • {g.marca}</span>
                        {g.status === 'em_evento' && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Em evento</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Identificação *</label>
                  <input
                    value={form.equipamentoLabel}
                    onChange={e => { set('equipamentoLabel', e.target.value); set('equipamentoId', '') }}
                    className="input"
                    placeholder={form.equipamentoTipo === 'caminhao' ? 'Ex: Placa ABC-1234' : 'Ex: Empilhadeira 01'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de manutenção</label>
                <div className="flex gap-2">
                  {[['preventiva', 'Preventiva'], ['corretiva', 'Corretiva']].map(([val, label]) => (
                    <button key={val} onClick={() => set('tipo', val)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                        ${form.tipo === val ? 'bg-brand-black text-white border-brand-black' : 'bg-white border-gray-200 text-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do serviço *</label>
                <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
                  rows={2} className="input resize-none"
                  placeholder="Ex: Troca de filtros preventiva..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro atual</label>
                <input type="number" value={form.horimetroAbertura} onChange={e => set('horimetroAbertura', e.target.value)}
                  className="input" placeholder="Ex: 12450" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quem está retirando os filtros? *</label>
                <div className="flex gap-2">
                  {['NILTON', 'FABIO', 'FRANÇA'].map(m => (
                    <button key={m} onClick={() => set('mecanico', m)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors
                        ${form.mecanico === m ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-4">
              <div className="bg-brand-red/5 border border-brand-red/20 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-brand-black">{form.equipamentoLabel}</p>
                <p className="text-xs text-gray-500 capitalize">{form.tipo}</p>
              </div>

              {itensSelecionados.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Selecionados ({itensSelecionados.length})
                  </p>
                  {itensSelecionados.map(i => (
                    <div key={i.filtro.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-black truncate">{i.filtro.nome}</p>
                        <p className="text-xs text-gray-400">{i.filtro.potenciaGG} • em estoque: {i.filtro.quantidadeAtual}</p>
                      </div>
                      <input
                        type="number" min="1" max={i.filtro.quantidadeAtual}
                        value={i.quantidade}
                        onChange={e => setQuantidade(i.filtro.id, parseInt(e.target.value) || 1)}
                        className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      />
                      <button onClick={() => removerFiltro(i.filtro.id)}
                        className="text-gray-300 hover:text-brand-red transition-colors flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input type="search" placeholder="Buscar filtro por nome, referência ou potência..."
                value={buscaFiltro} onChange={e => setBuscaFiltro(e.target.value)} className="input" />

              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {agrupados.map(([potencia, itens]) => (
                  <div key={potencia}>
                    <p className="text-xs font-bold text-brand-red mb-1.5 sticky top-0 bg-white py-0.5">{potencia}</p>
                    <div className="space-y-1">
                      {itens.map(f => {
                        const jaSelecionado = itensSelecionados.some(i => i.filtro.id === f.id)
                        return (
                          <button key={f.id} onClick={() => adicionarFiltro(f)} disabled={jaSelecionado}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors
                              ${jaSelecionado
                                ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                                : 'bg-white border-gray-100 hover:border-brand-red hover:bg-red-50'}`}>
                            <span className="font-medium">{f.nome}</span>
                            {f.referencia && <span className="ml-2 text-xs text-gray-400">{f.referencia}</span>}
                            <span className={`float-right text-xs font-semibold ${f.quantidadeAtual <= 0 ? 'text-brand-red' : 'text-gray-500'}`}>
                              {jaSelecionado ? '✓' : `${f.quantidadeAtual} un`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100 space-y-2">
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-3">
            {passo === 1 ? (
              <>
                <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={avancar} className="btn-primary flex-1 justify-center">Próximo →</button>
              </>
            ) : (
              <>
                <button onClick={() => { setPasso(1); setErro('') }} className="btn-secondary">← Voltar</button>
                <button onClick={confirmar} disabled={salvando || itensSelecionados.length === 0}
                  className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {salvando
                    ? 'Registrando...'
                    : `Confirmar Saída (${itensSelecionados.length} filtro${itensSelecionados.length !== 1 ? 's' : ''})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
