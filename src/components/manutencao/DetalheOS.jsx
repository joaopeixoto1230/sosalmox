import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useDocument, useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { statusOsLabel, statusOsCor, formatarDataHora, formatarData } from '../../utils/formatters'

export default function DetalheOS() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { uid, nome } = useAuth()
  const { dado: os, carregando } = useDocument('ordens_servico', id)
  const { dados: filtros } = useCollection('filtros')

  const [horimetroConc, setHorimetroConc] = useState('')
  const [filtrosSelecionados, setFiltrosSelecionados] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

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
    setSalvando(true); setErro('')
    try {
      await runTransaction(db, async (tx) => {
        const osRef = doc(db, 'ordens_servico', id)
        tx.update(osRef, {
          status: 'concluida',
          horimetroConсlusao: parseInt(horimetroConc),
          filtrosUsados: filtrosSelecionados,
          dataConclusao: serverTimestamp(),
          concluidoPor: uid,
          concluidoPorNome: nome,
        })

        for (const f of filtrosSelecionados) {
          const fRef = doc(db, 'filtros', f.id)
          const snap = await tx.get(fRef)
          const atual = snap.data()?.quantidadeAtual || 0
          tx.update(fRef, { quantidadeAtual: Math.max(0, atual - f.qtdUsada) })

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
        }

        if (os?.equipamentoTipo === 'gerador' && os?.equipamentoId) {
          tx.update(doc(db, 'geradores', os.equipamentoId), {
            status: 'disponivel',
            localizacao: 'Pátio SOS',
            horimetroAtual: parseInt(horimetroConc),
            ultimaManutencao: serverTimestamp(),
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
      await runTransaction(db, async (tx) => {
        tx.update(doc(db, 'ordens_servico', id), { status: novoStatus })
      })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!os) return <div className="text-center py-12 text-gray-400"><p>OS não encontrada.</p></div>

  const concluida = os.status === 'concluida'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/manutencao')} className="btn-ghost px-2">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-brand-black">{os.numero}</h1>
            <span className={`badge ${statusOsCor(os.status)}`}>{statusOsLabel(os.status)}</span>
            {os.prioridade === 'maxima' && <span className="badge bg-brand-red text-white">URGENTE</span>}
          </div>
          <p className="text-gray-500 text-sm">{os.equipamentoLabel}</p>
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
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Descrição</p>
          <p className="text-sm text-brand-black">{os.descricao}</p>
        </div>
        {os.observacoes && <div>
          <p className="text-gray-400 text-xs mb-1">Observações</p>
          <p className="text-sm text-gray-600">{os.observacoes}</p>
        </div>}
        {concluida && os.filtrosUsados?.length > 0 && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Filtros utilizados</p>
            <div className="space-y-1">
              {os.filtrosUsados.map(f => (
                <p key={f.id} className="text-sm text-gray-600">• {f.nome} — {f.qtdUsada} {f.unidade || 'un'}</p>
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

            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            <button onClick={concluir} disabled={salvando} className="btn-primary w-full justify-center">
              {salvando ? 'Concluindo...' : 'Concluir Ordem de Serviço'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
