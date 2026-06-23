import { useState, useMemo } from 'react'
import { doc, updateDoc, serverTimestamp, runTransaction, collection, addDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData } from '../../utils/formatters'

const STATUS_COR = {
  pendente: 'bg-yellow-100 text-yellow-700',
  em_cotacao: 'bg-blue-100 text-blue-700',
  comprado: 'bg-purple-100 text-purple-700',
  entregue: 'bg-green-100 text-green-700',
}
const STATUS_LABEL = {
  pendente: 'Pendente',
  em_cotacao: 'Em Cotação',
  comprado: 'Comprado',
  entregue: 'Entregue',
}
const PROXIMOS = {
  pendente: { label: 'Em Cotação', value: 'em_cotacao' },
  em_cotacao: { label: 'Marcar Comprado', value: 'comprado' },
  comprado: { label: 'Confirmar Entrega', value: 'entregue' },
}
// liga o card de contador (chave do status) ao label usado no filtro de pills
const STATUS_FILTRO_LABEL = {
  pendente: 'Pendente',
  em_cotacao: 'Em Cotação',
  comprado: 'Comprado',
  entregue: 'Entregue',
}
const TIPO_LABEL = { material: 'Material', filtro: 'Filtro', outro: 'Outro' }

export default function FilaSolicitacoes() {
  const { uid, nome } = useAuth()
  const { dados: solicitacoes, carregando } = useCollection('solicitacoes_compra')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState(null)
  const [modalEntrega, setModalEntrega] = useState(null)
  const [modalNova, setModalNova] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)

  const filtradas = useMemo(() => {
    const statusMap = { 'Pendente': 'pendente', 'Em Cotação': 'em_cotacao', 'Comprado': 'comprado', 'Entregue': 'entregue' }
    return solicitacoes
      .filter(s => statusFiltro === 'Todos' || s.status === statusMap[statusFiltro])
      .filter(s => {
        if (!busca) return true
        const q = busca.toLowerCase()
        return s.itemNome?.toLowerCase().includes(q) || s.referencia?.toLowerCase().includes(q) || s.potenciaGG?.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const urgA = (a.urgente || (a.quantidadeAtual <= 0)) && a.status !== 'entregue' ? 0 : 1
        const urgB = (b.urgente || (b.quantidadeAtual <= 0)) && b.status !== 'entregue' ? 0 : 1
        if (urgA !== urgB) return urgA - urgB
        const ordemStatus = { pendente: 0, em_cotacao: 1, comprado: 2, entregue: 3 }
        if (ordemStatus[a.status] !== ordemStatus[b.status]) return ordemStatus[a.status] - ordemStatus[b.status]
        const da = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0)
        const db2 = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0)
        return db2 - da
      })
  }, [solicitacoes, statusFiltro, busca])

  const contadores = useMemo(() => ({
    pendente: solicitacoes.filter(s => s.status === 'pendente').length,
    em_cotacao: solicitacoes.filter(s => s.status === 'em_cotacao').length,
    comprado: solicitacoes.filter(s => s.status === 'comprado').length,
    entregue: solicitacoes.filter(s => s.status === 'entregue').length,
  }), [solicitacoes])

  async function avancarStatus(sol) {
    const proximo = PROXIMOS[sol.status]
    if (!proximo) return
    if (proximo.value === 'entregue') { setModalEntrega(sol); return }
    setAtualizando(sol.id)
    try {
      await updateDoc(doc(db, 'solicitacoes_compra', sol.id), {
        status: proximo.value,
        atualizadoEm: serverTimestamp(),
      })
    } finally {
      setAtualizando(null)
    }
  }

  async function confirmarEntrega(sol, qtdEntregue, preco) {
    setAtualizando(sol.id)
    try {
      await runTransaction(db, async (tx) => {
        tx.update(doc(db, 'solicitacoes_compra', sol.id), {
          status: 'entregue',
          quantidadeEntregue: qtdEntregue,
          precoUnitario: preco || 0,
          total: (preco || 0) * qtdEntregue,
          entregueEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
        if (sol.itemId && sol.tipo === 'filtro') {
          const filtroRef = doc(db, 'filtros', sol.itemId)
          const snap = await tx.get(filtroRef)
          if (snap.exists()) {
            const atual = snap.data().quantidadeAtual || 0
            const entradaRef = doc(collection(db, 'entradas_filtro'))
            tx.set(entradaRef, {
              filtroId: sol.itemId,
              filtroNome: sol.itemNome,
              quantidade: qtdEntregue,
              fornecedor: sol.fornecedor || '',
              dataEntrada: serverTimestamp(),
              operadorUid: uid,
              operadorNome: nome,
              criadoEm: serverTimestamp(),
            })
            tx.update(filtroRef, { quantidadeAtual: atual + qtdEntregue })
          }
        }
      })
      setModalEntrega(null)
    } finally {
      setAtualizando(null)
    }
  }

  function gerarRelatorio(sol) {
    const dt = (v) => v?.toDate ? v.toDate().toLocaleString('pt-BR') : '—'
    const numero = `#${(sol.id || '').slice(0, 6).toUpperCase()}`
    const origem = sol.origem === 'manual' ? 'Manual' : 'Automática (estoque mínimo)'
    const linha = (label, valor) => valor || valor === 0
      ? `<div class="field"><label>${label}</label><p>${valor}</p></div>` : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Solicitação ${numero}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; padding: 0; color: #111; max-width: 700px; margin: 0 auto; font-size: 13px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-top: 24px; margin-bottom: 16px; border-bottom: 2px solid #CC0000; padding-bottom: 12px; }
    .header h1 { color: #CC0000; margin: 0; font-size: 19px; }
    .header p { margin: 2px 0; color: #555; font-size: 12px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #f0f0f0; color: #444; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0; }
    .field label { font-size: 10px; color: #888; display: block; margin-bottom: 1px; }
    .field p { font-size: 13px; font-weight: 600; margin: 0; }
    .section-title { font-size: 12px; font-weight: bold; color: #555; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { margin-top: 16px; font-size: 10px; color: #aaa; text-align: right; }
    .assinatura { display: grid; grid-template-columns: 1fr; justify-items: center; margin-top: 40px; page-break-inside: avoid; }
    .assinatura .bloco { width: 60%; max-width: 320px; text-align: center; }
    .assinatura .traco { border-top: 1px solid #999; padding-top: 5px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>SOS Energia — Solicitação de Compra</h1>
      <p>${numero} &nbsp;•&nbsp; ${sol.itemNome || '—'}</p>
    </div>
    <div><span class="badge">${STATUS_LABEL[sol.status] || sol.status}</span></div>
  </div>

  <div class="grid">
    ${linha('Item / Produto', sol.itemNome)}
    ${linha('Tipo', TIPO_LABEL[sol.tipo] || sol.tipo)}
    ${linha('Potência GG', sol.potenciaGG)}
    ${linha('Referência', sol.referencia)}
    ${linha('Fornecedor', sol.fornecedor)}
    ${linha('Quantidade sugerida', sol.quantidadeSugerida)}
    ${linha('Estoque atual', sol.quantidadeAtual)}
    ${linha('Estoque mínimo', sol.estoqueMin)}
    ${linha('Origem', origem)}
    ${linha('Urgente', sol.urgente ? 'Sim' : '')}
    ${linha('Solicitante', sol.solicitanteNome)}
    ${linha('Criada em', dt(sol.criadoEm))}
    ${sol.status === 'entregue' ? `
    ${linha('Quantidade entregue', sol.quantidadeEntregue)}
    ${linha('Preço unitário', sol.precoUnitario != null ? 'R$ ' + Number(sol.precoUnitario).toFixed(2) : '')}
    ${linha('Total', sol.total != null ? 'R$ ' + Number(sol.total).toFixed(2) : '')}
    ${linha('Entregue em', dt(sol.entregueEm))}
    ` : ''}
  </div>

  ${sol.observacao ? `<p class="section-title">Observação</p><p style="font-size:13px;color:#555;white-space:pre-wrap">${sol.observacao}</p>` : ''}

  <div class="assinatura">
    <div class="bloco">
      <div class="traco">Responsável pela compra</div>
    </div>
  </div>

  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`

    // imprime por um iframe oculto na própria página (mesmo padrão da Manutenção),
    // sem abrir aba nova — que travava o sistema ao voltar.
    const anterior = document.getElementById('solicitacao-print-frame')
    if (anterior) anterior.remove()

    const iframe = document.createElement('iframe')
    iframe.id = 'solicitacao-print-frame'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        } catch { /* ignore */ }
        setTimeout(() => iframe.remove(), 60000)
      }, 300)
    }
    document.body.appendChild(iframe)
    iframe.srcdoc = html
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Fila de Solicitações</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as solicitações de compra do almoxarifado.</p>
        </div>
        <button onClick={() => setModalNova(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Solicitação
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[['pendente', 'Pendentes', 'bg-yellow-50 border-yellow-200'], ['em_cotacao', 'Em Cotação', 'bg-blue-50 border-blue-200'], ['comprado', 'Comprado', 'bg-purple-50 border-purple-200'], ['entregue', 'Entregue', 'bg-green-50 border-green-200']].map(([status, label, cls]) => {
          const ativo = statusFiltro === STATUS_FILTRO_LABEL[status]
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFiltro(ativo ? 'Todos' : STATUS_FILTRO_LABEL[status])}
              className={`card border ${cls} text-center py-3 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${ativo ? 'ring-2 ring-brand-red ring-offset-1' : ''}`}
            >
              <p className="text-xl font-bold text-brand-black">{contadores[status]}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="input flex-1 min-w-40"
          placeholder="Buscar item, referência, potência..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['Todos', 'Pendente', 'Em Cotação', 'Comprado', 'Entregue'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${statusFiltro === s ? 'bg-white shadow-sm text-brand-black' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Nenhuma solicitação{statusFiltro !== 'Todos' ? ` ${statusFiltro.toLowerCase()}` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(s => {
            const urgente = s.quantidadeAtual <= 0 && s.status !== 'entregue'
            return (
            <div key={s.id} onClick={() => setModalDetalhe(s)} className={`card flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow ${urgente ? 'border border-red-200 bg-red-50/40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-brand-black text-sm">{s.itemNome}</p>
                  {s.potenciaGG && <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{s.potenciaGG}</span>}
                  {s.urgente && <span className="badge bg-orange-100 text-orange-700 text-xs">Urgente</span>}
                  {urgente && <span className="badge bg-red-100 text-brand-red text-xs">Estoque zerado</span>}
                  <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                  {s.referencia && <p className="text-xs text-gray-400">Ref: {s.referencia}</p>}
                  <p className="text-xs text-gray-400">
                    Estoque: <span className={s.quantidadeAtual <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{s.quantidadeAtual}</span>
                    {' / min '}{s.estoqueMin}
                  </p>
                  <p className="text-xs text-gray-400">Sugerido: <strong className="text-gray-600">{s.quantidadeSugerida}</strong></p>
                  {s.fornecedor && <p className="text-xs text-gray-400">Fornecedor: {s.fornecedor}</p>}
                  <p className="text-xs text-gray-300">{formatarData(s.criadoEm)}</p>
                </div>
              </div>
              {PROXIMOS[s.status] && (
                <button
                  onClick={(e) => { e.stopPropagation(); avancarStatus(s) }}
                  disabled={atualizando === s.id}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  {atualizando === s.id ? '...' : PROXIMOS[s.status].label}
                </button>
              )}
            </div>
          )
          })}
        </div>
      )}

      {modalEntrega && (
        <ModalConfirmarEntrega
          solicitacao={modalEntrega}
          onConfirmar={(qtd, preco) => confirmarEntrega(modalEntrega, qtd, preco)}
          onFechar={() => setModalEntrega(null)}
          salvando={atualizando === modalEntrega.id}
        />
      )}

      {modalNova && (
        <ModalNovaSolicitacao
          uid={uid}
          nome={nome}
          onFechar={() => setModalNova(false)}
        />
      )}

      {modalDetalhe && (
        <ModalDetalheSolicitacao
          solicitacao={modalDetalhe}
          onFechar={() => setModalDetalhe(null)}
          onGerarRelatorio={() => gerarRelatorio(modalDetalhe)}
          onAvancar={() => { const s = modalDetalhe; setModalDetalhe(null); avancarStatus(s) }}
        />
      )}
    </div>
  )
}

function ModalDetalheSolicitacao({ solicitacao: s, onFechar, onGerarRelatorio, onAvancar }) {
  const urgenteZerado = s.quantidadeAtual <= 0 && s.status !== 'entregue'
  const origem = s.origem === 'manual' ? 'Manual' : 'Automática (estoque mínimo)'
  const proximo = PROXIMOS[s.status]

  const Campo = ({ label, valor, destaque }) => (valor || valor === 0) ? (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${destaque || 'text-brand-black'}`}>{valor}</p>
    </div>
  ) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-brand-black">{s.itemNome}</h2>
              <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[s.status] || s.status}</span>
              {s.urgente && <span className="badge bg-orange-100 text-orange-700 text-xs">Urgente</span>}
              {urgenteZerado && <span className="badge bg-red-100 text-brand-red text-xs">Estoque zerado</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">Solicitação #{(s.id || '').slice(0, 6).toUpperCase()}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tipo" valor={TIPO_LABEL[s.tipo] || s.tipo} />
            <Campo label="Potência GG" valor={s.potenciaGG} />
            <Campo label="Referência" valor={s.referencia} />
            <Campo label="Fornecedor" valor={s.fornecedor} />
            <Campo label="Qtd. sugerida" valor={s.quantidadeSugerida} />
            <Campo label="Estoque atual" valor={s.quantidadeAtual} destaque={s.quantidadeAtual <= 0 ? 'text-brand-red' : ''} />
            <Campo label="Estoque mínimo" valor={s.estoqueMin} />
            <Campo label="Origem" valor={origem} />
            <Campo label="Solicitante" valor={s.solicitanteNome} />
            <Campo label="Criada em" valor={formatarData(s.criadoEm)} />
          </div>

          {s.status === 'entregue' && (
            <div className="grid grid-cols-2 gap-4 bg-green-50 rounded-xl p-3">
              <Campo label="Qtd. entregue" valor={s.quantidadeEntregue} />
              <Campo label="Preço unitário" valor={s.precoUnitario != null ? `R$ ${Number(s.precoUnitario).toFixed(2)}` : null} />
              <Campo label="Total" valor={s.total != null ? `R$ ${Number(s.total).toFixed(2)}` : null} />
              <Campo label="Entregue em" valor={formatarData(s.entregueEm)} />
            </div>
          )}

          {s.observacao && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Observação</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">{s.observacao}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onGerarRelatorio} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Gerar Relatório
            </button>
            {proximo && (
              <button onClick={onAvancar} className="btn-primary flex-1">{proximo.label}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalNovaSolicitacao({ uid, nome, onFechar }) {
  const [form, setForm] = useState({
    itemNome: '',
    quantidadeSugerida: 1,
    tipo: 'material',
    fornecedor: '',
    urgente: false,
    observacao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function salvar() {
    if (!form.itemNome.trim()) { setErro('Nome do item é obrigatório'); return }
    if (!form.quantidadeSugerida || form.quantidadeSugerida < 1) { setErro('Quantidade deve ser maior que zero'); return }
    setSalvando(true)
    setErro('')
    try {
      await addDoc(collection(db, 'solicitacoes_compra'), {
        itemNome: form.itemNome.trim(),
        quantidadeSugerida: Number(form.quantidadeSugerida),
        quantidadeAtual: 0,
        estoqueMin: 0,
        tipo: form.tipo,
        fornecedor: form.fornecedor.trim() || null,
        urgente: form.urgente,
        observacao: form.observacao.trim() || null,
        status: 'pendente',
        origem: 'manual',
        solicitanteUid: uid,
        solicitanteNome: nome,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Nova Solicitação de Compra</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Item / Produto *</label>
            <input
              value={form.itemNome}
              onChange={e => set('itemNome', e.target.value)}
              placeholder="Ex: Filtro de Óleo 60kVA, Cabo 4x35..."
              className="input"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Quantidade *</label>
              <input
                type="number"
                min="1"
                value={form.quantidadeSugerida}
                onChange={e => set('quantidadeSugerida', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input">
                <option value="material">Material</option>
                <option value="filtro">Filtro</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fornecedor sugerido</label>
            <input
              value={form.fornecedor}
              onChange={e => set('fornecedor', e.target.value)}
              placeholder="Ex: Fleetguard, Tecfil..."
              className="input"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea
              value={form.observacao}
              onChange={e => set('observacao', e.target.value)}
              placeholder="Ex: referência específica, urgência, onde usar..."
              rows={3}
              className="input resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => set('urgente', !form.urgente)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.urgente ? 'bg-brand-red' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.urgente ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Urgente</span>
            {form.urgente && <span className="badge bg-red-100 text-brand-red text-xs">Aparece no topo da fila</span>}
          </label>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Criar Solicitação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalConfirmarEntrega({ solicitacao, onConfirmar, onFechar, salvando }) {
  const [qtd, setQtd] = useState(String(solicitacao.quantidadeSugerida || 1))
  const [preco, setPreco] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Confirmar entrega</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{solicitacao.itemNome}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade recebida *</label>
            <input type="number" min="1" className="input w-full" value={qtd} onChange={e => setQtd(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço unitário (R$)</label>
            <input type="number" min="0" step="0.01" className="input w-full" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" />
          </div>
          {solicitacao.tipo === 'filtro' && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              ✅ O estoque de filtros será atualizado automaticamente.
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={() => onConfirmar(parseInt(qtd) || 1, parseFloat(preco) || 0)}
              disabled={salvando}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
