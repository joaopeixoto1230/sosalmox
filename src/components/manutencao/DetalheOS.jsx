import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, runTransaction, serverTimestamp, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useDocument, useCollection } from '../../hooks/useFirestore'
import { criarSolicitacaoCompra } from '../../utils/notificacoes'
import { useAuth } from '../../contexts/AuthContext'
import { statusOsLabel, statusOsCor, formatarDataHora } from '../../utils/formatters'

export default function DetalheOS() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { uid, nome, tipoPerfil } = useAuth()
  const { dado: os, carregando } = useDocument('ordens_servico', id)
  const { dados: filtros } = useCollection('filtros')

  const [horimetroConc, setHorimetroConc] = useState('')
  const [relatorio, setRelatorio] = useState('')
  const [problemasEncontrados, setProblemasEncontrados] = useState('')
  const [proximaPreventiva, setProximaPreventiva] = useState('')
  const [filtrosSelecionados, setFiltrosSelecionados] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  const [editando, setEditando] = useState(false)
  const [adicionandoFiltros, setAdicionandoFiltros] = useState(false)

  function toggleFiltro(filtro) {
    setFiltrosSelecionados(prev =>
      prev.some(f => f.id === filtro.id) ? prev.filter(f => f.id !== filtro.id) : [...prev, { ...filtro, qtdUsada: 1 }]
    )
  }

  function setQtdFiltro(filtroId, qtd) {
    setFiltrosSelecionados(prev => prev.map(f => f.id === filtroId ? { ...f, qtdUsada: parseInt(qtd) || 1 } : f))
  }

  async function concluir() {
    if (!horimetroConc) { setErro('Informe o horímetro de conclusão.'); return }
    if (!relatorio.trim()) { setErro('Descreva o serviço executado.'); return }
    setSalvando(true); setErro('')
    try {
      const viaFiltros = os.origem === 'saida_filtros'

      await runTransaction(db, async (tx) => {
        const osRef = doc(db, 'ordens_servico', id)

        const baseUpdate = {
          status: 'concluida',
          horimetroConсlusao: parseInt(horimetroConc),
          relatorioServico: relatorio.trim(),
          problemasEncontrados: problemasEncontrados.trim() || null,
          proximaPreventiva: proximaPreventiva || null,
          dataConclusao: serverTimestamp(),
          concluidoPor: uid,
          concluidoPorNome: nome,
        }

        if (!viaFiltros) {
          baseUpdate.filtrosUsados = filtrosSelecionados

          // ALL READS FIRST
          const filtroRefs = filtrosSelecionados.map(f => doc(db, 'filtros', f.id))
          const filtroSnaps = await Promise.all(filtroRefs.map(r => tx.get(r)))

          // WRITES
          tx.update(osRef, baseUpdate)

          filtrosSelecionados.forEach((f, idx) => {
            const atual = filtroSnaps[idx].data()?.quantidadeAtual || 0
            tx.update(filtroRefs[idx], { quantidadeAtual: Math.max(0, atual - f.qtdUsada) })
            const baixaRef = doc(db, 'baixas_filtro', `${id}_${f.id}`)
            tx.set(baixaRef, {
              filtroId: f.id,
              filtroNome: f.nome,
              quantidade: f.qtdUsada,
              motivo: `OS ${os?.numero}`,
              ordemServicoId: id,
              operadorUid: uid,
              operadorNome: nome,
              criadoEm: serverTimestamp(),
            })
          })
        } else {
          tx.update(osRef, baseUpdate)
        }

        if (os?.equipamentoTipo === 'gerador' && os?.equipamentoId) {
          tx.update(doc(db, 'geradores', os.equipamentoId), {
            status: 'disponivel',
            localizacao: 'Pátio SOS',
            horimetroAtual: parseInt(horimetroConc),
            ultimaManutencao: serverTimestamp(),
            ...(proximaPreventiva ? { proximaPreventiva } : {}),
          })
        }
      })
      navigate('/manutencao')
    } catch (e) {
      setErro(e.message || 'Erro ao concluir OS.')
    } finally {
      setSalvando(false)
    }
  }

  async function atualizarStatus(novoStatus) {
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'ordens_servico', id), { status: novoStatus })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    setSalvando(true)
    try {
      if (os?.equipamentoTipo === 'gerador' && os?.equipamentoId) {
        if (os?.status !== 'concluida') {
          await updateDoc(doc(db, 'geradores', os.equipamentoId), {
            status: 'disponivel',
            localizacao: 'Pátio SOS',
          })
        } else {
          const snap = await getDocs(query(collection(db, 'ordens_servico'), where('equipamentoId', '==', os.equipamentoId)))
          const concluidasRestantes = snap.docs
            .filter(d => d.id !== id && d.data().status === 'concluida')
            .map(d => d.data())
            .sort((a, b) => {
              const ta = a.dataConclusao?.toDate ? a.dataConclusao.toDate().getTime() : 0
              const tb = b.dataConclusao?.toDate ? b.dataConclusao.toDate().getTime() : 0
              return tb - ta
            })
          const ultima = concluidasRestantes[0]
          await updateDoc(doc(db, 'geradores', os.equipamentoId), {
            ultimaManutencao: ultima?.dataConclusao || null,
            proximaPreventiva: ultima?.proximaPreventiva || null,
          })
        }
      }
      await deleteDoc(doc(db, 'ordens_servico', id))
      navigate('/manutencao')
    } catch (e) {
      setErro(e.message || 'Erro ao excluir OS.')
      setSalvando(false)
    }
  }

  function gerarPDF() {
    const filtrosLista = os.filtrosUsados?.length
      ? os.filtrosUsados.map(f => `<tr><td>${f.filtroNome || f.nome || '—'}</td><td>${f.potenciaGG || '—'}</td><td style="text-align:center">${f.quantidade || f.qtdUsada || 1}</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:#888">Nenhum filtro registrado</td></tr>'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>OS ${os.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 30px; color: #111; max-width: 700px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #CC0000; padding-bottom: 16px; }
    .header h1 { color: #CC0000; margin: 0; font-size: 22px; }
    .header p { margin: 2px 0; color: #555; font-size: 13px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #e5f5e5; color: #2a7a2a; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin: 16px 0; }
    .field label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
    .field p { font-size: 14px; font-weight: 600; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th { background: #f0f0f0; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ccc; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    .section-title { font-size: 13px; font-weight: bold; color: #555; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: right; }
    .assinatura { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .assinatura div { border-top: 1px solid #999; padding-top: 6px; font-size: 12px; color: #555; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>SOS Energia — Ordem de Serviço</h1>
      <p>${os.numero} &nbsp;•&nbsp; ${os.equipamentoLabel}</p>
    </div>
    <div>
      <span class="badge">${statusOsLabel(os.status)}</span>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Tipo</label><p>${os.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}</p></div>
    <div class="field"><label>Mecânico</label><p>${os.mecanicoNome || '—'}</p></div>
    <div class="field"><label>Data de abertura</label><p>${os.dataAbertura?.toDate ? os.dataAbertura.toDate().toLocaleString('pt-BR') : '—'}</p></div>
    ${os.status === 'concluida' ? `
    <div class="field"><label>Data de conclusão</label><p>${os.dataConclusao?.toDate ? os.dataConclusao.toDate().toLocaleString('pt-BR') : '—'}</p></div>
    <div class="field"><label>Horímetro conclusão</label><p>${os.horimetroConсlusao ? os.horimetroConсlusao + 'h' : '—'}</p></div>
    ` : ''}
    ${os.almoxarifeNome ? `<div class="field"><label>Entregue por (almoxarife)</label><p>${os.almoxarifeNome}</p></div>` : ''}
  </div>

  <p class="section-title">Descrição do serviço</p>
  <p style="font-size:14px">${os.descricao || '—'}</p>
  ${os.relatorioServico ? `<p class="section-title">Relatório do serviço executado</p><p style="font-size:13px;white-space:pre-wrap">${os.relatorioServico}</p>` : ''}
  ${os.problemasEncontrados ? `<p class="section-title" style="color:#c05000">Problemas encontrados</p><p style="font-size:13px;color:#c05000;background:#fff7ed;padding:8px 12px;border-radius:8px;white-space:pre-wrap">${os.problemasEncontrados}</p>` : ''}
  ${os.proximaPreventiva ? `<p class="section-title">Próxima preventiva</p><p style="font-size:14px;font-weight:bold;color:#1d4ed8">${os.proximaPreventiva}</p>` : ''}
  ${os.observacoes ? `<p class="section-title">Observações</p><p style="font-size:13px;color:#555">${os.observacoes}</p>` : ''}

  <p class="section-title">Filtros utilizados</p>
  <table>
    <thead><tr><th>Filtro</th><th>Potência GG</th><th style="text-align:center">Qtd</th></tr></thead>
    <tbody>${filtrosLista}</tbody>
  </table>

  <div class="assinatura">
    <div>Mecânico: ${os.mecanicoNome || '_______________'}</div>
    <div>Responsável: _______________</div>
  </div>

  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  if (carregando) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!os) return <div className="text-center py-12 text-gray-400"><p>OS não encontrada.</p></div>

  const concluida = os.status === 'concluida'
  const viaFiltros = os.origem === 'saida_filtros'
  const podeEditar = !concluida && ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)
  const podeExcluir = ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)
  const podeAdicionarFiltros = !concluida && ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/manutencao')} className="btn-ghost px-2">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-brand-black">{os.numero}</h1>
            <span className={`badge ${statusOsCor(os.status)}`}>{statusOsLabel(os.status)}</span>
            {os.prioridade === 'maxima' && <span className="badge bg-brand-red text-white">URGENTE</span>}
          </div>
          <p className="text-gray-500 text-sm">{os.equipamentoLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {concluida && (
            <button onClick={gerarPDF} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>
          )}
          {podeAdicionarFiltros && (
            <button onClick={() => setAdicionandoFiltros(true)} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Filtros
            </button>
          )}
          {podeEditar && (
            <button onClick={() => setEditando(true)} className="btn-secondary text-sm px-3 py-1.5">
              Editar
            </button>
          )}
          {podeExcluir && (
            <button onClick={() => setConfirmarExcluir(true)} className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              Excluir
            </button>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-400 text-xs">Tipo</p><p className="font-medium capitalize">{os.tipo}</p></div>
          <div><p className="text-gray-400 text-xs">Mecânico</p><p className="font-medium">{os.mecanicoNome}</p></div>
          <div><p className="text-gray-400 text-xs">Abertura</p><p className="font-medium">{formatarDataHora(os.dataAbertura)}</p></div>
          {os.horimetroAbertura && <div><p className="text-gray-400 text-xs">Horímetro abertura</p><p className="font-medium">{os.horimetroAbertura}h</p></div>}
          {concluida && <div><p className="text-gray-400 text-xs">Conclusão</p><p className="font-medium">{formatarDataHora(os.dataConclusao)}</p></div>}
          {concluida && os.horimetroConсlusao && <div><p className="text-gray-400 text-xs">Horímetro conclusão</p><p className="font-medium">{os.horimetroConсlusao}h</p></div>}
          {os.almoxarifeNome && <div><p className="text-gray-400 text-xs">Entregue por</p><p className="font-medium">{os.almoxarifeNome}</p></div>}
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Descrição</p>
          <p className="text-sm text-brand-black">{os.descricao}</p>
        </div>
        {os.observacoes && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Observações</p>
            <p className="text-sm text-gray-600">{os.observacoes}</p>
          </div>
        )}
        {concluida && os.relatorioServico && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Relatório do serviço executado</p>
            <p className="text-sm text-brand-black whitespace-pre-wrap">{os.relatorioServico}</p>
          </div>
        )}
        {concluida && os.problemasEncontrados && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Problemas encontrados</p>
            <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{os.problemasEncontrados}</p>
          </div>
        )}
        {concluida && os.proximaPreventiva && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Próxima preventiva</p>
            <p className="text-sm font-medium text-blue-700">{os.proximaPreventiva}</p>
          </div>
        )}
        {os.filtrosUsados?.length > 0 && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Filtros {viaFiltros ? 'entregues pelo almoxarife' : 'utilizados'}</p>
            <div className="space-y-1">
              {os.filtrosUsados.map((f, i) => (
                <p key={i} className="text-sm text-gray-600">
                  • {f.filtroNome || f.nome} — {f.quantidade || f.qtdUsada || 1} un
                  {f.potenciaGG && <span className="text-gray-400 ml-1">({f.potenciaGG})</span>}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {!concluida && (
        <>
          {os.status === 'pendente' && (
            <button onClick={() => atualizarStatus('em_andamento')} disabled={salvando} className="btn-secondary w-full justify-center">
              Iniciar manutenção
            </button>
          )}

          <div className="card space-y-4">
            <h2 className="font-semibold text-brand-black">Concluir OS</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro de conclusão *</label>
              <input type="number" value={horimetroConc} onChange={e => setHorimetroConc(e.target.value)}
                className="input" placeholder="Ex: 12480" />
            </div>

            {!viaFiltros && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtros utilizados (opcional)</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2">
                  {filtros.filter(f => f.ativo !== false).map(f => {
                    const sel = filtrosSelecionados.find(s => s.id === f.id)
                    return (
                      <div key={f.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`} onClick={() => toggleFiltro(f)}>
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${sel ? 'bg-brand-red border-brand-red' : 'border-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-brand-black truncate">{f.nome}</p>
                          <p className="text-xs text-gray-400">{f.potenciaGG} • estoque: {f.quantidadeAtual}</p>
                        </div>
                        {sel && (
                          <input type="number" min="1" value={sel.qtdUsada} onClick={e => e.stopPropagation()}
                            onChange={e => setQtdFiltro(f.id, e.target.value)}
                            className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relatório do serviço executado *</label>
              <textarea
                value={relatorio}
                onChange={e => setRelatorio(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Descreva o que foi executado: filtros trocados, verificações realizadas, estado do equipamento..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problemas encontrados</label>
              <textarea
                value={problemasEncontrados}
                onChange={e => setProblemasEncontrados(e.target.value)}
                rows={2}
                className="input resize-none"
                placeholder="Ex: vazamento na mangueira X, correia desgastada — monitorar..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Próxima preventiva</label>
              <input
                value={proximaPreventiva}
                onChange={e => setProximaPreventiva(e.target.value)}
                className="input"
                placeholder="Ex: 500h ou 10/09/2026"
              />
            </div>

            {viaFiltros && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700 font-medium">
                  ✅ Filtros já registrados na saída pelo almoxarife
                </p>
                <p className="text-xs text-green-600 mt-0.5">O estoque foi atualizado no momento da retirada.</p>
              </div>
            )}

            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            <button onClick={concluir} disabled={salvando} className="btn-primary w-full justify-center">
              {salvando ? 'Concluindo...' : 'Concluir Ordem de Serviço'}
            </button>
          </div>
        </>
      )}

      {confirmarExcluir && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-brand-black">Excluir OS {os.numero}?</h2>
            <p className="text-sm text-gray-600">Esta ação não pode ser desfeita. O gerador será liberado automaticamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarExcluir(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={excluir} disabled={salvando} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                {salvando ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <ModalEditarOS os={os} onFechar={() => setEditando(false)} />
      )}

      {adicionandoFiltros && (
        <ModalAdicionarFiltros os={os} osId={id} uid={uid} nome={nome} onFechar={() => setAdicionandoFiltros(false)} />
      )}
    </div>
  )
}

function ModalAdicionarFiltros({ os, osId, uid, nome, onFechar }) {
  const { dados: filtros } = useCollection('filtros')
  const [selecionados, setSelecionados] = useState([])
  const [busca, setBusca] = useState('')
  const [mecanico, setMecanico] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const filtrosDisponiveis = useMemo(() => {
    return filtros
      .filter(f => f.ativo !== false)
      .filter(f => {
        if (!busca) return true
        const q = busca.toLowerCase()
        return f.nome?.toLowerCase().includes(q) || f.referencia?.toLowerCase().includes(q) || f.potenciaGG?.toLowerCase().includes(q)
      })
  }, [filtros, busca])

  const agrupados = useMemo(() => {
    const map = new Map()
    filtrosDisponiveis.forEach(f => {
      const key = f.potenciaGG || 'Outros'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(f)
    })
    return Array.from(map.entries()).sort(([a], [b]) => (parseInt(a) || 9999) - (parseInt(b) || 9999))
  }, [filtrosDisponiveis])

  function toggle(filtro) {
    setSelecionados(prev =>
      prev.some(s => s.filtro.id === filtro.id)
        ? prev.filter(s => s.filtro.id !== filtro.id)
        : [...prev, { filtro, quantidade: 1 }]
    )
  }

  function setQtd(filtroId, qtd) {
    setSelecionados(prev => prev.map(s => s.filtro.id === filtroId ? { ...s, quantidade: Math.max(1, parseInt(qtd) || 1) } : s))
  }

  async function confirmar() {
    if (selecionados.length === 0) { setErro('Adicione ao menos um filtro.'); return }
    if (!mecanico) { setErro('Selecione quem está retirando.'); return }
    setSalvando(true); setErro('')
    try {
      const filtrosAtualizados = []

      await runTransaction(db, async (tx) => {
        // ALL READS FIRST
        const osSnap = await tx.get(doc(db, 'ordens_servico', osId))
        const filtroRefs = selecionados.map(s => doc(db, 'filtros', s.filtro.id))
        const filtroSnaps = await Promise.all(filtroRefs.map(r => tx.get(r)))

        // CALCULATE
        const existentes = osSnap.data()?.filtrosUsados || []
        const novosItens = selecionados.map(s => ({
          filtroId: s.filtro.id,
          filtroNome: s.filtro.nome,
          quantidade: s.quantidade,
          potenciaGG: s.filtro.potenciaGG || '',
        }))
        const novasQtds = filtroSnaps.map((snap, idx) => {
          const atual = snap.data()?.quantidadeAtual || 0
          return atual - selecionados[idx].quantidade
        })

        // ALL WRITES
        tx.update(doc(db, 'ordens_servico', osId), {
          filtrosUsados: [...existentes, ...novosItens],
        })

        selecionados.forEach((item, idx) => {
          tx.update(filtroRefs[idx], { quantidadeAtual: novasQtds[idx] })
          const baixaRef = doc(collection(db, 'baixas_filtro'))
          tx.set(baixaRef, {
            filtroId: item.filtro.id,
            filtroNome: item.filtro.nome,
            potenciaGG: item.filtro.potenciaGG || '',
            quantidade: item.quantidade,
            motivo: `Adição OS ${os.numero} — ${os.equipamentoLabel}`,
            ordemServicoNumero: os.numero,
            equipamentoLabel: os.equipamentoLabel,
            retiradoPor: mecanico,
            operadorUid: uid,
            operadorNome: nome,
            criadoEm: serverTimestamp(),
          })
          filtrosAtualizados.push({ ...item.filtro, quantidadeAtual: novasQtds[idx] })
        })
      })

      for (const f of filtrosAtualizados) {
        if ((f.estoqueMin || 0) > 0 && f.quantidadeAtual <= f.estoqueMin) {
          await criarSolicitacaoCompra(f).catch(() => {})
        }
      }

      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao adicionar filtros.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Adicionar Filtros</h2>
            <p className="text-xs text-gray-400 mt-0.5">{os.numero} — {os.equipamentoLabel}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quem está retirando? *</label>
            <div className="flex gap-2">
              {['NILTON', 'FABIO', 'FRANÇA'].map(m => (
                <button key={m} onClick={() => setMecanico(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors
                    ${mecanico === m ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {selecionados.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selecionados ({selecionados.length})</p>
              {selecionados.map(s => (
                <div key={s.filtro.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.filtro.nome}</p>
                    <p className="text-xs text-gray-400">{s.filtro.potenciaGG} • estoque: {s.filtro.quantidadeAtual}</p>
                  </div>
                  <input type="number" min="1" max={s.filtro.quantidadeAtual}
                    value={s.quantidade}
                    onChange={e => setQtd(s.filtro.id, e.target.value)}
                    className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                  <button onClick={() => toggle(s.filtro)} className="text-gray-300 hover:text-brand-red transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <input type="search" placeholder="Buscar filtro..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />

          <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
            {agrupados.map(([potencia, itens]) => (
              <div key={potencia}>
                <p className="text-xs font-bold text-brand-red mb-1.5">{potencia}</p>
                <div className="space-y-1">
                  {itens.map(f => {
                    const sel = selecionados.some(s => s.filtro.id === f.id)
                    return (
                      <button key={f.id} onClick={() => toggle(f)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors
                          ${sel
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                            : 'bg-white border-gray-100 hover:border-brand-red hover:bg-red-50'}`}>
                        <span className="font-medium">{f.nome}</span>
                        {f.referencia && <span className="ml-2 text-xs text-gray-400">{f.referencia}</span>}
                        <span className={`float-right text-xs font-semibold ${sel ? 'text-green-600' : f.quantidadeAtual <= 0 ? 'text-brand-red' : 'text-gray-500'}`}>
                          {sel ? '✓ remover' : `${f.quantidadeAtual} un`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100 space-y-2">
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-3">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={confirmar} disabled={salvando || selecionados.length === 0}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {salvando ? 'Registrando...' : `Confirmar (${selecionados.length} filtro${selecionados.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalEditarOS({ os, onFechar }) {
  const [form, setForm] = useState({
    tipo: os.tipo || 'preventiva',
    descricao: os.descricao || '',
    horimetroAbertura: os.horimetroAbertura || '',
    observacoes: os.observacoes || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function salvar() {
    if (!form.descricao.trim()) { setErro('Descrição é obrigatória.'); return }
    setSalvando(true); setErro('')
    try {
      await updateDoc(doc(db, 'ordens_servico', os.id), {
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        horimetroAbertura: form.horimetroAbertura ? parseInt(form.horimetroAbertura) : null,
        observacoes: form.observacoes.trim() || '',
      })
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Editar OS {os.numero}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
              rows={3} className="input resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro abertura</label>
            <input type="number" value={form.horimetroAbertura} onChange={e => set('horimetroAbertura', e.target.value)}
              className="input" placeholder="Ex: 12450" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              rows={2} className="input resize-none" placeholder="Informações adicionais..." />
          </div>
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <div className="flex gap-3">
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
