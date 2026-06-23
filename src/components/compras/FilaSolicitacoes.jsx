import { useState, useMemo, useRef } from 'react'
import { doc, updateDoc, serverTimestamp, runTransaction, collection, addDoc, where, getDocs, query, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData } from '../../utils/formatters'
import SignaturePad from '../ui/SignaturePad'

// Carrega uma imagem (File) num elemento <img> — funciona em qualquer celular.
function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler a imagem')) }
    img.src = url
  })
}

// Comprime a foto e devolve um data URL (JPEG base64) para guardar no Firestore.
// Mesmo padrão das fotos da OS — sem Storage/plano pago, cabe abaixo do limite de 1 MB do doc.
async function comprimirParaDataUrl(file, maxBytes = 650000) {
  if (!file?.type?.startsWith('image/')) throw new Error('O arquivo selecionado não é uma imagem.')
  const img = await carregarImagem(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let maxLado = 1280
  let qualidade = 0.6
  let dataUrl = ''
  for (let i = 0; i < 9; i++) {
    let { width, height } = img
    const escala = Math.min(1, maxLado / Math.max(width, height))
    width = Math.round(width * escala)
    height = Math.round(height * escala)
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    dataUrl = canvas.toDataURL('image/jpeg', qualidade)
    if (dataUrl.length <= maxBytes) return dataUrl
    if (qualidade > 0.4) qualidade -= 0.1
    else maxLado = Math.round(maxLado * 0.85)
  }
  return dataUrl
}

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
// número sequencial legível da solicitação: SOL-ANO-NNN (ex: SOL-2026-001)
function formatarNumeroSolicitacao(numero) {
  const ano = new Date().getFullYear()
  return `SOL-${ano}-${String(numero).padStart(3, '0')}`
}
// rótulo do número exibido: usa o número novo se houver, senão cai no id curto (solicitações antigas)
function numeroSolicitacao(s) {
  return s.numero || `#${(s.id || '').slice(0, 6).toUpperCase()}`
}

export default function FilaSolicitacoes() {
  const { uid, nome } = useAuth()
  const { dados: solicitacoes, carregando } = useCollection('solicitacoes_compra')
  const { dados: tiposCol } = useCollection('tipos_solicitacao')
  const { dados: fornecedoresCol } = useCollection('fornecedores')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState(null)
  const [modalEntrega, setModalEntrega] = useState(null)
  const [modalNova, setModalNova] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalStatus, setModalStatus] = useState(null)
  const [menuAberto, setMenuAberto] = useState(null)

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

  // tipos disponíveis no seletor: padrões fixos + os salvos (coleção tipos_solicitacao)
  // + os já usados em solicitações, sem repetir. Um tipo novo digitado vira padrão ao salvar.
  const tiposSugeridos = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const t of ['Material', 'Filtro', 'Outro', ...tiposCol.map(t => t.nome), ...solicitacoes.map(s => s.tipo)]) {
      if (!t) continue
      const k = String(t).trim().toLowerCase()
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(String(t).trim())
    }
    return out
  }, [tiposCol, solicitacoes])

  // nomes de fornecedores cadastrados (ativos) para o seletor da solicitação
  const fornecedoresNomes = useMemo(() => (
    fornecedoresCol
      .filter(f => f.ativo !== false && f.nome)
      .map(f => f.nome.trim())
      .sort((a, b) => a.localeCompare(b))
  ), [fornecedoresCol])

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

  async function confirmarEntrega(sol, qtdEntregue, preco, notaFiscalFile) {
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
      // nota fiscal (opcional): guarda como foto na coleção fotos_solicitacao,
      // marcada com notaFiscal=true para aparecer separada nas fotos comuns.
      if (notaFiscalFile) {
        const dataUrl = await comprimirParaDataUrl(notaFiscalFile)
        await addDoc(collection(db, 'fotos_solicitacao'), {
          solicitacaoId: sol.id,
          notaFiscal: true,
          ordem: -1,
          dataUrl,
          criadoEm: serverTimestamp(),
        })
      }
      setModalEntrega(null)
    } finally {
      setAtualizando(null)
    }
  }

  async function definirStatus(s, novoStatus) {
    setModalStatus(null)
    if (novoStatus === s.status) return
    if (novoStatus === 'entregue') { setModalEntrega(s); return }
    setAtualizando(s.id)
    try {
      await updateDoc(doc(db, 'solicitacoes_compra', s.id), {
        status: novoStatus,
        atualizadoEm: serverTimestamp(),
      })
    } finally {
      setAtualizando(null)
    }
  }

  async function excluirSolicitacao(s) {
    setMenuAberto(null)
    if (!window.confirm(`Excluir a solicitação ${numeroSolicitacao(s)} (${s.itemNome})? Esta ação não pode ser desfeita.`)) return
    setAtualizando(s.id)
    try {
      // remove também as fotos da solicitação (docs da coleção fotos_solicitacao)
      const fotosSnap = await getDocs(query(collection(db, 'fotos_solicitacao'), where('solicitacaoId', '==', s.id)))
      await Promise.all(fotosSnap.docs.map(d => deleteDoc(d.ref)))
      await deleteDoc(doc(db, 'solicitacoes_compra', s.id))
    } finally {
      setAtualizando(null)
    }
  }

  function gerarRelatorio(sol, fotos = [], notaFiscal = null) {
    const dt = (v) => v?.toDate ? v.toDate().toLocaleString('pt-BR') : '—'
    const numero = numeroSolicitacao(sol)
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
    .assinatura img { display: block; margin: 0 auto -4px; height: 48px; object-fit: contain; }
    .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; page-break-inside: avoid; break-inside: avoid; }
    .fotos img { width: 100%; height: 140px; object-fit: contain; background: #f7f7f7; border-radius: 5px; border: 1px solid #ddd; }
    @media print { .fotos img, .assinatura img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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

  ${fotos && fotos.length ? `
  <p class="section-title">Fotos da solicitação</p>
  <div class="fotos">${fotos.map(f => `<img src="${f.dataUrl}" />`).join('')}</div>
  ` : ''}

  ${notaFiscal ? `
  <p class="section-title">Nota fiscal</p>
  <div class="fotos"><img src="${notaFiscal.dataUrl}" /></div>
  ` : ''}

  <div class="assinatura">
    <div class="bloco">
      ${sol.assinaturaSolicitante ? `<img src="${sol.assinaturaSolicitante}" />` : ''}
      <div class="traco">Solicitante: ${sol.assinaturaSolicitanteNome || sol.solicitanteNome || '_______________'}</div>
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
            <div key={s.id} onClick={() => setModalDetalhe(s)} className={`card flex items-start justify-between gap-3 sm:gap-4 cursor-pointer hover:shadow-md transition-shadow ${urgente ? 'border border-red-200 bg-red-50/40' : ''}`}>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-brand-black truncate">{s.itemNome}</p>
                  {s.potenciaGG && <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{s.potenciaGG}</span>}
                  <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{numeroSolicitacao(s)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                  {s.urgente && <span className="badge bg-orange-100 text-orange-700">Urgente</span>}
                  {urgente && <span className="badge bg-red-100 text-brand-red">Estoque zerado</span>}
                </div>
                <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap text-xs text-gray-400">
                  <span>
                    Estoque <span className={s.quantidadeAtual <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600 font-medium'}>{s.quantidadeAtual}</span>
                    <span className="text-gray-300"> / mín {s.estoqueMin}</span>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>Sugerido <strong className="text-gray-600">{s.quantidadeSugerida}</strong></span>
                  {s.referencia && <><span className="text-gray-300">•</span><span>Ref: {s.referencia}</span></>}
                  {s.fornecedor && <><span className="text-gray-300">•</span><span>{s.fornecedor}</span></>}
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300">{formatarData(s.criadoEm)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                {PROXIMOS[s.status] && (
                  <button
                    onClick={() => avancarStatus(s)}
                    disabled={atualizando === s.id}
                    className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
                  >
                    {atualizando === s.id ? '...' : PROXIMOS[s.status].label}
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setMenuAberto(v => v === s.id ? null : s.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="Mais opções"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </button>
                  {menuAberto === s.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(null)} />
                      <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-1 overflow-hidden">
                        <button onClick={() => { setMenuAberto(null); setModalDetalhe(s) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Ver detalhes</button>
                        <button onClick={() => { setMenuAberto(null); setModalEditar(s) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Editar solicitação</button>
                        <button onClick={() => { setMenuAberto(null); setModalStatus(s) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Mudar status</button>
                        <div className="h-px bg-gray-100 my-1" />
                        <button onClick={() => excluirSolicitacao(s)} className="w-full text-left px-3 py-2 text-sm text-brand-red hover:bg-red-50 transition-colors">Excluir solicitação</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
          })}
        </div>
      )}

      {modalEntrega && (
        <ModalConfirmarEntrega
          solicitacao={modalEntrega}
          onConfirmar={(qtd, preco, nf) => confirmarEntrega(modalEntrega, qtd, preco, nf)}
          onFechar={() => setModalEntrega(null)}
          salvando={atualizando === modalEntrega.id}
        />
      )}

      {modalNova && (
        <ModalNovaSolicitacao
          uid={uid}
          nome={nome}
          tiposSugeridos={tiposSugeridos}
          fornecedoresNomes={fornecedoresNomes}
          solicitacoes={solicitacoes}
          onFechar={() => setModalNova(false)}
        />
      )}

      {modalDetalhe && (
        <ModalDetalheSolicitacao
          solicitacao={modalDetalhe}
          onFechar={() => setModalDetalhe(null)}
          onGerarRelatorio={(fotos, nf) => gerarRelatorio(modalDetalhe, fotos, nf)}
          onAvancar={() => { const s = modalDetalhe; setModalDetalhe(null); avancarStatus(s) }}
        />
      )}

      {modalEditar && (
        <ModalEditarSolicitacao
          solicitacao={modalEditar}
          tiposSugeridos={tiposSugeridos}
          fornecedoresNomes={fornecedoresNomes}
          onFechar={() => setModalEditar(null)}
        />
      )}

      {modalStatus && (
        <ModalMudarStatus
          solicitacao={modalStatus}
          onSelecionar={(novo) => definirStatus(modalStatus, novo)}
          onFechar={() => setModalStatus(null)}
        />
      )}
    </div>
  )
}

function ModalMudarStatus({ solicitacao: s, onSelecionar, onFechar }) {
  const ordem = ['pendente', 'em_cotacao', 'comprado', 'entregue']
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Mudar status</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-1.5">
          {ordem.map(st => (
            <button
              key={st}
              onClick={() => onSelecionar(st)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${st === s.status ? 'border-brand-red bg-red-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <span className={`badge ${STATUS_COR[st]}`}>{STATUS_LABEL[st]}</span>
              {st === s.status && <span className="text-xs text-brand-red font-medium">atual</span>}
            </button>
          ))}
          <p className="text-xs text-gray-400 pt-1 px-1">Ao escolher "Entregue", será pedida a quantidade e o preço.</p>
        </div>
      </div>
    </div>
  )
}

function ModalEditarSolicitacao({ solicitacao: s, tiposSugeridos = [], fornecedoresNomes = [], onFechar }) {
  const [form, setForm] = useState({
    itemNome: s.itemNome || '',
    quantidadeSugerida: s.quantidadeSugerida || 1,
    tipo: s.tipo || 'Material',
    fornecedor: s.fornecedor || '',
    urgente: !!s.urgente,
    observacao: s.observacao || '',
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
      await updateDoc(doc(db, 'solicitacoes_compra', s.id), {
        itemNome: form.itemNome.trim(),
        quantidadeSugerida: Number(form.quantidadeSugerida),
        tipo: form.tipo,
        fornecedor: form.fornecedor.trim() || null,
        urgente: form.urgente,
        observacao: form.observacao.trim() || null,
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
          <h2 className="font-bold text-brand-black">Editar solicitação</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Item / Produto *</label>
            <input value={form.itemNome} onChange={e => set('itemNome', e.target.value)} className="input" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Quantidade *</label>
              <input type="number" min="1" value={form.quantidadeSugerida} onChange={e => set('quantidadeSugerida', e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
              <SeletorComNovo value={form.tipo} onChange={v => set('tipo', v)} opcoes={tiposSugeridos} labelNovo="+ Novo tipo…" placeholder="Nome do novo tipo (ex: Filtro de óleo)" voltarPara="Material" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fornecedor</label>
            <SeletorComNovo
              value={form.fornecedor}
              onChange={v => set('fornecedor', v)}
              opcoes={fornecedoresNomes}
              labelNovo="+ Outro fornecedor…"
              placeholder="Nome do fornecedor"
              permitirVazio
              vazioLabel="— Selecione —"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)} rows={3} className="input resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => set('urgente', !form.urgente)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.urgente ? 'bg-brand-red' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.urgente ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Urgente</span>
          </label>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalDetalheSolicitacao({ solicitacao: s, onFechar, onGerarRelatorio, onAvancar }) {
  const urgenteZerado = s.quantidadeAtual <= 0 && s.status !== 'entregue'
  const origem = s.origem === 'manual' ? 'Manual' : 'Automática (estoque mínimo)'
  const proximo = PROXIMOS[s.status]
  const { dados: fotosRaw } = useCollection('fotos_solicitacao', useMemo(() => [where('solicitacaoId', '==', s.id)], [s.id]), s.id)
  const fotos = useMemo(() => fotosRaw.filter(f => !f.notaFiscal).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)), [fotosRaw])
  const notaFiscal = useMemo(() => fotosRaw.find(f => f.notaFiscal) || null, [fotosRaw])
  const [fotoAmpliada, setFotoAmpliada] = useState(null)

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
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-semibold text-gray-500">{numeroSolicitacao(s)}</span>
              <span className="text-gray-300"> • {formatarData(s.criadoEm)}</span>
            </p>
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

          {fotos.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Fotos ({fotos.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map(f => (
                  <button key={f.id} type="button" onClick={() => setFotoAmpliada(f.dataUrl)} className="block aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in">
                    <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {notaFiscal && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Nota fiscal</p>
              <button type="button" onClick={() => setFotoAmpliada(notaFiscal.dataUrl)} className="block w-32 aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in">
                <img src={notaFiscal.dataUrl} alt="Nota fiscal" className="w-full h-full object-cover" />
              </button>
            </div>
          )}

          {s.assinaturaSolicitante && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Assinatura do solicitante</p>
              <div className="rounded-lg border border-gray-200 bg-white p-2 inline-block">
                <img src={s.assinaturaSolicitante} alt="Assinatura" className="h-16 object-contain" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{s.assinaturaSolicitanteNome || s.solicitanteNome}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => onGerarRelatorio(fotos, notaFiscal)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
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

      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Fechar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={fotoAmpliada} alt="Foto da solicitação" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// Seletor reutilizável: dropdown com a opção "+ Novo…" dentro da própria lista
// (mesmo padrão do NovoMaterialModal). Ao escolher, vira um campo para digitar.
// Usado para Tipo e para Fornecedor.
const VALOR_NOVO = '__novo__'
function SeletorComNovo({ value, onChange, opcoes = [], labelNovo = '+ Novo…', placeholder = '', permitirVazio = false, vazioLabel = '—', voltarPara = '' }) {
  const [modoNovo, setModoNovo] = useState(false)

  // garante que o valor atual apareça no select mesmo se não estiver na lista
  const lista = value && !opcoes.some(o => o.toLowerCase() === value.toLowerCase())
    ? [value, ...opcoes]
    : opcoes

  if (modoNovo) {
    return (
      <div>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input"
        />
        <button
          type="button"
          onClick={() => { setModoNovo(false); onChange(permitirVazio ? '' : (opcoes[0] || voltarPara)) }}
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
        >← Escolher da lista</button>
      </div>
    )
  }

  return (
    <select
      value={value || ''}
      onChange={e => {
        if (e.target.value === VALOR_NOVO) { setModoNovo(true); onChange('') }
        else onChange(e.target.value)
      }}
      className="input"
    >
      {permitirVazio && <option value="">{vazioLabel}</option>}
      {lista.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={VALOR_NOVO}>{labelNovo}</option>
    </select>
  )
}

// última compra entregue do mesmo item (preço/data/fornecedor), p/ ajudar na cotação
function ultimaCompraDoItem(solicitacoes, itemNome, excluirId) {
  const nome = (itemNome || '').trim().toLowerCase()
  if (!nome) return null
  const candidatas = solicitacoes
    .filter(s => s.id !== excluirId && s.status === 'entregue' && s.precoUnitario > 0 && (s.itemNome || '').trim().toLowerCase() === nome)
    .sort((a, b) => {
      const da = a.entregueEm?.toDate ? a.entregueEm.toDate() : new Date(a.entregueEm || a.criadoEm || 0)
      const db2 = b.entregueEm?.toDate ? b.entregueEm.toDate() : new Date(b.entregueEm || b.criadoEm || 0)
      return db2 - da
    })
  return candidatas[0] || null
}

function ModalNovaSolicitacao({ uid, nome, tiposSugeridos = [], fornecedoresNomes = [], solicitacoes = [], onFechar }) {
  const [form, setForm] = useState({
    itemNome: '',
    quantidadeSugerida: 1,
    tipo: 'Material',
    fornecedor: '',
    urgente: false,
    observacao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [fotos, setFotos] = useState([])
  const [assinatura, setAssinatura] = useState('')
  const [progresso, setProgresso] = useState(null)
  const fotoInputRef = useRef(null)

  // histórico: última compra entregue do mesmo item, para ajudar a cotar
  const ultima = useMemo(() => ultimaCompraDoItem(solicitacoes, form.itemNome), [solicitacoes, form.itemNome])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function adicionarFotos(e) {
    const arquivos = Array.from(e.target.files || [])
    if (arquivos.length === 0) return
    setFotos(prev => [...prev, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file) }))])
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  function removerFoto(idx) {
    setFotos(prev => {
      const f = prev[idx]
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function salvar() {
    if (!form.itemNome.trim()) { setErro('Nome do item é obrigatório'); return }
    if (!form.quantidadeSugerida || form.quantidadeSugerida < 1) { setErro('Quantidade deve ser maior que zero'); return }
    if (!assinatura) { setErro('A assinatura do solicitante é obrigatória.'); return }
    setSalvando(true)
    setErro('')
    try {
      // número sequencial SOL-ANO-NNN via contador transacional (igual às OS):
      // lê o contador, incrementa e grava a solicitação com o número, tudo atômico.
      const ref = doc(collection(db, 'solicitacoes_compra'))
      await runTransaction(db, async (tx) => {
        const contRef = doc(db, 'contadores', 'solicitacoes_compra')
        const contSnap = await tx.get(contRef)
        const ultimo = contSnap.exists() ? (contSnap.data().ultimo || 0) : 0
        const proximo = ultimo + 1
        tx.set(contRef, { ultimo: proximo }, { merge: true })
        tx.set(ref, {
          numero: formatarNumeroSolicitacao(proximo),
          numeroSeq: proximo,
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
          assinaturaSolicitante: assinatura,
          assinaturaSolicitanteNome: nome,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
      })

      // fotos: uma por documento na coleção fotos_solicitacao (comprimidas, base64),
      // mesmo padrão das fotos da OS — sem Storage/plano pago.
      for (let i = 0; i < fotos.length; i++) {
        setProgresso({ atual: i + 1, total: fotos.length })
        const dataUrl = await comprimirParaDataUrl(fotos[i].file)
        await addDoc(collection(db, 'fotos_solicitacao'), {
          solicitacaoId: ref.id,
          ordem: i,
          dataUrl,
          criadoEm: serverTimestamp(),
        })
      }
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
      setSalvando(false)
      setProgresso(null)
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
            {ultima && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-1.5">
                Última compra: <strong>R$ {Number(ultima.precoUnitario).toFixed(2)}</strong> em {formatarData(ultima.entregueEm || ultima.criadoEm)}
                {ultima.fornecedor ? ` — ${ultima.fornecedor}` : ''}
              </p>
            )}
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
              <SeletorComNovo value={form.tipo} onChange={v => set('tipo', v)} opcoes={tiposSugeridos} labelNovo="+ Novo tipo…" placeholder="Nome do novo tipo (ex: Filtro de óleo)" voltarPara="Material" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fornecedor</label>
            <SeletorComNovo
              value={form.fornecedor}
              onChange={v => set('fornecedor', v)}
              opcoes={fornecedoresNomes}
              labelNovo="+ Outro fornecedor…"
              placeholder="Nome do fornecedor"
              permitirVazio
              vazioLabel="— Selecione —"
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

          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs font-medium text-gray-600 block mb-2">Fotos (comprovação)</label>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerFoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                  >✕</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-red hover:text-brand-red transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px] mt-1">Adicionar</span>
              </button>
            </div>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={adicionarFotos}
              className="hidden"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <SignaturePad titulo="Assinatura do solicitante *" valor={assinatura} onChange={setAssinatura} />
          </div>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} disabled={salvando} className="btn-secondary flex-1 disabled:opacity-50">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando
                ? (progresso ? `Enviando foto ${progresso.atual}/${progresso.total}...` : 'Salvando...')
                : 'Criar Solicitação'}
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
  const [nf, setNf] = useState(null)
  const nfRef = useRef(null)
  const total = (parseFloat(preco) || 0) * (parseInt(qtd) || 0)

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

          {total > 0 && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              Total: <strong className="text-brand-black">R$ {total.toFixed(2)}</strong>
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota fiscal (opcional)</label>
            {nf ? (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-600 truncate flex-1">📎 {nf.name}</span>
                <button type="button" onClick={() => { setNf(null); if (nfRef.current) nfRef.current.value = '' }} className="text-xs text-brand-red font-medium">Remover</button>
              </div>
            ) : (
              <button type="button" onClick={() => nfRef.current?.click()} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Anexar nota fiscal
              </button>
            )}
            <input ref={nfRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setNf(e.target.files?.[0] || null)} />
          </div>

          {solicitacao.tipo === 'filtro' && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              ✅ O estoque de filtros será atualizado automaticamente.
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={() => onConfirmar(parseInt(qtd) || 1, parseFloat(preco) || 0, nf)}
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
