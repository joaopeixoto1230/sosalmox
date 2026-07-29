import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, runTransaction, collection, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarNumeroOS } from '../../utils/formatters'
import { criarSolicitacaoCompra } from '../../utils/notificacoes'
import { idsFiltrosIguais } from '../filtros/filtrosUtils'

export default function NovaOS() {
  const navigate = useNavigate()
  const { uid, nome } = useAuth()
  const { dados: geradores } = useCollection('geradores')
  const { dados: caminhoes } = useCollection('caminhoes')
  const { dados: filtros } = useCollection('filtros')

  const [passo, setPasso] = useState(1)
  const [form, setForm] = useState({
    equipamentoTipo: 'gerador',
    equipamentoId: '',
    equipamentoLabel: '',
    localTipo: 'patio',
    clienteNome: '',
    localObra: '',
    tipo: 'preventiva',
    descricao: '',
    horimetroAbertura: '',
    observacoes: '',
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

  const veiculosAtivos = useMemo(
    () => caminhoes
      .filter(c => c.ativo !== false && c.status !== 'inativo')
      .sort((a, b) => (a.placa || '').localeCompare(b.placa || '')),
    [caminhoes]
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

  function selecionarVeiculo(c) {
    set('equipamentoId', c.id)
    const detalhe = [c.marca, c.modelo].filter(Boolean).join(' ')
    set('equipamentoLabel', detalhe ? `${c.placa} — ${detalhe}` : c.placa)
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
      prev.map(i => i.filtro.id === filtroId
        ? { ...i, quantidade: qtd === '' ? '' : Math.max(1, qtd) }
        : i)
    )
  }

  function avancar() {
    if (!form.equipamentoLabel) { setErro('Selecione um equipamento.'); return }
    if (form.localTipo === 'locacao' && !form.clienteNome.trim()) { setErro('Informe o cliente da locação.'); return }
    if (!form.descricao.trim()) { setErro('Descreva o serviço a realizar.'); return }
    if (!form.mecanico) { setErro('Selecione quem vai fazer a manutenção.'); return }
    setErro('')
    setPasso(2)
  }

  async function confirmar() {
    const temFiltros = itensSelecionados.length > 0
    const itens = itensSelecionados.map(i => ({ ...i, quantidade: Math.max(1, parseInt(i.quantidade) || 1) }))
    setSalvando(true); setErro('')
    try {
      const isGG = form.equipamentoTipo === 'gerador' && form.equipamentoId
      const ehLocacao = form.localTipo === 'locacao'
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

        // estoque compartilhado: cada item baixa também os filtros iguais (mesma referência)
        const gruposPorItem = itens.map(i => idsFiltrosIguais(filtros, i.filtro))
        const idsUnicos = [...new Set(gruposPorItem.flat())]
        const refPorId = new Map(idsUnicos.map(id => [id, doc(db, 'filtros', id)]))
        const snapEntries = await Promise.all(idsUnicos.map(async id => [id, await tx.get(refPorId.get(id))]))
        const snapPorId = new Map(snapEntries)

        // ── CÁLCULOS ──
        const ultimo = contSnap.exists() ? (contSnap.data().ultimo || 0) : 0
        const proximo = ultimo + 1
        osNumero = formatarNumeroOS(proximo)

        const novasQtds = itens.map(item => {
          const atual = snapPorId.get(item.filtro.id)?.data()?.quantidadeAtual || 0
          return atual - item.quantidade
        })
        const writesQtd = new Map()
        itens.forEach((item, idx) => {
          gruposPorItem[idx].forEach(id => writesQtd.set(id, novasQtds[idx]))
        })

        const filtrosUsados = itens.map(i => ({
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
          localTipo: form.localTipo,
          clienteNome: ehLocacao ? form.clienteNome.trim() : null,
          localObra: ehLocacao ? (form.localObra.trim() || null) : null,
          descricao: form.descricao.trim(),
          horimetroAbertura: form.horimetroAbertura ? parseInt(form.horimetroAbertura) : null,
          observacoes: form.observacoes.trim(),
          mecanicoUid: null,
          mecanicoNome: form.mecanico,
          status: temFiltros ? 'em_andamento' : 'pendente',
          prioridade: eventoAtivo ? 'maxima' : 'normal',
          eventoAtivo,
          filtrosUsados,
          ...(temFiltros ? { origem: 'saida_filtros' } : {}),
          almoxarifeUid: uid,
          almoxarifeNome: nome,
          dataAbertura: serverTimestamp(),
          criadoEm: serverTimestamp(),
        })

        writesQtd.forEach((qtd, id) => tx.update(refPorId.get(id), { quantidadeAtual: qtd }))

        itens.forEach((item, idx) => {
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
            aplicadoEmIguais: gruposPorItem[idx].length,
            operadorUid: uid,
            operadorNome: nome,
            criadoEm: serverTimestamp(),
          })

          filtrosAtualizados.push({ ...item.filtro, quantidadeAtual: novasQtds[idx] })
        })

        // gerador no pátio entra "em manutenção". Gerador em locação fica no cliente — não mexe.
        if (isGG && !ehLocacao) {
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

      navigate('/manutencao')
    } catch (e) {
      setErro(e.message || 'Erro ao abrir OS.')
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/manutencao')} className="btn-ghost px-2">←</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-brand-black">Nova Ordem de Serviço</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${passo >= 1 ? 'bg-brand-red' : 'bg-gray-200'}`} />
            <div className={`w-8 h-0.5 ${passo >= 2 ? 'bg-brand-red' : 'bg-gray-200'}`} />
            <div className={`w-2 h-2 rounded-full ${passo >= 2 ? 'bg-brand-red' : 'bg-gray-200'}`} />
            <span className="text-xs text-gray-400 ml-1">{passo === 1 ? 'Equipamento' : 'Filtros'}</span>
          </div>
        </div>
      </div>

      {passo === 1 && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de equipamento</label>
            <div className="flex gap-2">
              {[['gerador', 'Gerador (GG)'], ['caminhao', 'Veículos'], ['empilhadeira', 'Empilhadeira']].map(([val, label]) => (
                <button key={val} onClick={() => { set('equipamentoTipo', val); set('equipamentoId', ''); set('equipamentoLabel', '') }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${form.equipamentoTipo === val ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.equipamentoTipo === 'gerador' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Gerador *</label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2">
                {geradoresAtivos.map(g => (
                  <button key={g.id} onClick={() => selecionarGerador(g)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${form.equipamentoId === g.id ? 'bg-brand-red text-white' : 'hover:bg-gray-50'}`}>
                    <span className="font-semibold">{g.codigo}</span>
                    <span className="ml-2 opacity-70">{g.potencia} • {g.marca}</span>
                    {g.status === 'em_evento' && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Em evento</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : form.equipamentoTipo === 'caminhao' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Veículo *</label>
              {veiculosAtivos.length === 0 ? (
                <p className="text-sm text-gray-400 border border-gray-200 rounded-xl px-3 py-4 text-center">
                  Nenhum veículo cadastrado. Cadastre na aba Veículos.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2">
                  {veiculosAtivos.map(c => (
                    <button key={c.id} onClick={() => selecionarVeiculo(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${form.equipamentoId === c.id ? 'bg-brand-red text-white' : 'hover:bg-gray-50'}`}>
                      <span className="font-semibold">{c.placa}</span>
                      {(c.marca || c.modelo) && <span className="ml-2 opacity-70">{[c.marca, c.modelo].filter(Boolean).join(' ')}</span>}
                      {c.tipo === 'carro' && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Carro</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do equipamento *</label>
              <input value={form.equipamentoLabel} onChange={e => { set('equipamentoLabel', e.target.value); set('equipamentoId', '') }}
                className="input" placeholder="Ex: Empilhadeira 01" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Local da manutenção</label>
            <div className="flex gap-2">
              {[['patio', 'No pátio (SOS)'], ['locacao', 'Em locação (cliente)']].map(([val, label]) => (
                <button key={val} onClick={() => set('localTipo', val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${form.localTipo === val ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.localTipo === 'locacao' && (
            <div className="space-y-4 rounded-xl bg-gray-50 border border-gray-100 p-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <input value={form.clienteNome} onChange={e => set('clienteNome', e.target.value)}
                  className="input" placeholder="Ex: CM Hospitalar S.A." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local / Obra</label>
                <input value={form.localObra} onChange={e => set('localObra', e.target.value)}
                  className="input" placeholder="Ex: Aeroporto Internacional de Brasília" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de manutenção</label>
            <div className="flex gap-2">
              {[['preventiva', 'Preventiva'], ['corretiva', 'Corretiva']].map(([val, label]) => (
                <button key={val} onClick={() => set('tipo', val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${form.tipo === val ? 'bg-brand-black text-white border-brand-black' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do serviço *</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
              rows={3} className="input resize-none" placeholder="Descreva o serviço a ser realizado..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{form.equipamentoTipo === 'caminhao' ? 'KM atual' : 'Horímetro atual'}</label>
            <input type="number" value={form.horimetroAbertura} onChange={e => set('horimetroAbertura', e.target.value)}
              className="input" placeholder={form.equipamentoTipo === 'caminhao' ? 'Ex: 84000' : 'Ex: 12450'} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quem vai fazer a manutenção? *</label>
            <div className="flex gap-2">
              {['NILTON', 'FABIO', 'FRANÇA'].map(m => (
                <button key={m} onClick={() => set('mecanico', m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${form.mecanico === m ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              rows={2} className="input resize-none" placeholder="Informações adicionais..." />
          </div>

          {erro && <p className="text-red-600 text-sm">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => navigate('/manutencao')} className="btn-secondary">Cancelar</button>
            <button onClick={avancar} className="btn-primary flex-1 justify-center">Próximo →</button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="card space-y-4">
          <div className="bg-brand-red/5 border border-brand-red/20 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-brand-black">{form.equipamentoLabel}</p>
            <p className="text-xs text-gray-500 capitalize">
              {form.tipo} • {form.localTipo === 'locacao' ? `Locação${form.clienteNome ? ` — ${form.clienteNome}` : ''}` : 'No pátio'} • {form.mecanico}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Filtros lançados pelo almoxarife</p>
            <p className="text-xs text-gray-400">Os filtros entregues agora já saem do estoque. Na conclusão o técnico só faz o relatório. (Opcional — pode abrir sem filtros.)</p>
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
                  <div className="flex items-center flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button type="button" onClick={() => setQuantidade(i.filtro.id, i.quantidade - 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-100 transition-colors text-lg leading-none">−</button>
                    <input type="number" inputMode="numeric" min="1" value={i.quantidade}
                      onChange={e => {
                        const v = e.target.value
                        if (v === '') { setQuantidade(i.filtro.id, ''); return }
                        setQuantidade(i.filtro.id, parseInt(v) || 1)
                      }}
                      onBlur={() => { if (!i.quantidade || i.quantidade < 1) setQuantidade(i.filtro.id, 1) }}
                      className="w-12 text-center text-sm font-semibold bg-transparent text-brand-black border-x border-gray-200 py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button type="button" onClick={() => setQuantidade(i.filtro.id, (parseInt(i.quantidade) || 0) + 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-100 transition-colors text-lg leading-none">+</button>
                  </div>
                  <button onClick={() => removerFiltro(i.filtro.id)} className="text-gray-300 hover:text-brand-red transition-colors flex-shrink-0">
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

          <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {agrupados.map(([potencia, itens]) => (
              <div key={potencia}>
                <p className="text-xs font-bold text-brand-red mb-1.5 sticky top-0 bg-white py-0.5">{potencia}</p>
                <div className="space-y-1">
                  {itens.map(f => {
                    const jaSelecionado = itensSelecionados.some(i => i.filtro.id === f.id)
                    return (
                      <button key={f.id} onClick={() => jaSelecionado ? removerFiltro(f.id) : adicionarFiltro(f)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors
                          ${jaSelecionado
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                            : 'bg-white border-gray-100 hover:border-brand-red hover:bg-red-50'}`}>
                        <span className="font-medium">{f.nome}</span>
                        {f.referencia && <span className="ml-2 text-xs text-gray-400">{f.referencia}</span>}
                        <span className={`float-right text-xs font-semibold ${jaSelecionado ? 'text-green-600' : f.quantidadeAtual <= 0 ? 'text-brand-red' : 'text-gray-500'}`}>
                          {jaSelecionado ? '✓ remover' : `${f.quantidadeAtual} un`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setPasso(1); setErro('') }} className="btn-secondary">← Voltar</button>
            <button onClick={confirmar} disabled={salvando} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {salvando
                ? 'Abrindo OS...'
                : itensSelecionados.length > 0
                ? `Abrir OS (${itensSelecionados.length} filtro${itensSelecionados.length !== 1 ? 's' : ''})`
                : 'Abrir OS sem filtros'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
