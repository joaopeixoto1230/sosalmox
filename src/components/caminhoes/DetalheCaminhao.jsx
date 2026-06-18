import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useDocument, useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { statusGeradorLabel, statusGeradorCor, statusOsLabel, statusOsCor, formatarData, statusEfetivoCaminhao, caminhaoSemKm, caminhaoKm } from '../../utils/formatters'
import { where } from 'firebase/firestore'

export default function DetalheCaminhao() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tipoPerfil } = useAuth()
  const { dado: caminhao, carregando } = useDocument('caminhoes', id)
  const { dados: ordens } = useCollection('ordens_servico', [where('equipamentoId', '==', id || '_')], id)
  const { dados: geradores } = useCollection('geradores')
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [buscaGer, setBuscaGer] = useState('')
  const [vinculando, setVinculando] = useState(false)

  const podeEditar = ['admin', 'gerente', 'almoxarife', 'franca'].includes(tipoPerfil)
  const podeVender = ['admin', 'gerente'].includes(tipoPerfil)

  function iniciarEdicao() {
    setForm({
      placa: caminhao.placa || '',
      marca: caminhao.marca || '',
      modelo: caminhao.modelo || '',
      ano: caminhao.ano || '',
      kmAtual: caminhaoKm(caminhao) ?? '',
      semKm: caminhaoSemKm(caminhao),
    })
    setEditando(true)
  }

  async function salvarEdicao() {
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'caminhoes', id), {
        placa: form.placa,
        marca: form.marca,
        modelo: form.modelo,
        ano: form.ano,
        semKm: form.semKm,
        kmAtual: form.semKm ? null : (form.kmAtual === '' ? null : Number(form.kmAtual)),
        atualizadoEm: serverTimestamp(),
      })
      setEditando(false)
    } finally {
      setSalvando(false)
    }
  }

  async function toggleDefeito() {
    const temDefeito = !caminhao.temDefeito
    await updateDoc(doc(db, 'caminhoes', id), {
      temDefeito,
      status: temDefeito ? 'defeito' : 'disponivel',
      defeito: temDefeito ? (caminhao.defeito || '') : '',
    })
  }

  async function marcarVendido() {
    if (!confirm(`Marcar ${caminhao.placa} como vendido/inativo? Ele sairá das listas operacionais.`)) return
    await updateDoc(doc(db, 'caminhoes', id), { status: 'inativo', ativo: false })
    navigate('/caminhoes')
  }

  async function excluirCaminhao() {
    if (!confirm(`Excluir o caminhão ${caminhao.placa} de vez? Esta ação não pode ser desfeita. Se ele só saiu da frota, prefira "Vendido".`)) return
    await deleteDoc(doc(db, 'caminhoes', id))
    navigate('/caminhoes')
  }

  async function vincularGerador(g) {
    setVinculando(true)
    try {
      await updateDoc(doc(db, 'caminhoes', id), { geradorMontadoId: g.id, geradorMontadoCodigo: g.codigo || null })
      setBuscaGer('')
    } finally {
      setVinculando(false)
    }
  }

  async function desvincularGerador() {
    if (!confirm('Remover o vínculo com o gerador montado? O status do caminhão deixa de acompanhá-lo.')) return
    await updateDoc(doc(db, 'caminhoes', id), { geradorMontadoId: null, geradorMontadoCodigo: null })
  }

  if (carregando) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!caminhao) return <div className="text-center py-12 text-gray-400"><p>Caminhão não encontrado.</p></div>

  // Gerador montado (vinculo opcional) e status exibido derivado dele.
  const gerMontado = caminhao.geradorMontadoId ? geradores.find(g => g.id === caminhao.geradorMontadoId) : null
  const statusEfetivo = statusEfetivoCaminhao(caminhao, gerMontado)
  const geradoresParaVincular = geradores
    .filter(g => g.ativo !== false && g.status !== 'inativo')
    .filter(g => {
      if (!buscaGer) return true
      const q = buscaGer.toLowerCase()
      return g.codigo?.toLowerCase().includes(q) || g.potencia?.toLowerCase().includes(q)
    })
    .sort((a, b) => parseInt(a.codigo?.replace(/\D/g, '') || '0') - parseInt(b.codigo?.replace(/\D/g, '') || '0'))
    .slice(0, 25)

  const historico = ordens.sort((a, b) => {
    const ta = a.dataAbertura?.toDate ? a.dataAbertura.toDate() : new Date(a.dataAbertura || 0)
    const tb = b.dataAbertura?.toDate ? b.dataAbertura.toDate() : new Date(b.dataAbertura || 0)
    return tb - ta
  })

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/caminhoes')} className="btn-ghost px-2">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-brand-black">{caminhao.placa}</h1>
            <span className={`badge ${statusGeradorCor(statusEfetivo)}`}>{statusGeradorLabel(statusEfetivo)}</span>
          </div>
          <p className="text-gray-500 text-sm">{caminhao.marca} {caminhao.modelo} {caminhao.ano && `(${caminhao.ano})`}</p>
        </div>
        {podeEditar && !editando && (
          <button onClick={iniciarEdicao} className="btn-secondary text-sm">Editar</button>
        )}
      </div>

      {editando ? (
        <div className="card space-y-3">
          <h2 className="font-semibold text-brand-black">Editar dados</h2>
          {[['placa', 'Placa', 'Ex: ABC-1234'], ['marca', 'Marca', 'Ex: Mercedes-Benz'], ['modelo', 'Modelo', 'Ex: Atego 2426'], ['ano', 'Ano', 'Ex: 2018']].map(([k, label, ph]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} className="input" placeholder={ph} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quilometragem (KM)</label>
            <input
              type="number"
              min="0"
              value={form.semKm ? '' : form.kmAtual}
              onChange={e => setForm(p => ({ ...p, kmAtual: e.target.value }))}
              disabled={form.semKm}
              className="input disabled:bg-gray-100 disabled:text-gray-400"
              placeholder={form.semKm ? 'Sem hodômetro' : 'Ex: 125000'}
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.semKm}
                onChange={e => setForm(p => ({ ...p, semKm: e.target.checked }))}
                className="w-4 h-4 accent-brand-red"
              />
              <span className="text-sm text-gray-600">Este caminhão não tem hodômetro (KM)</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEditando(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={salvarEdicao} disabled={salvando} className="btn-primary flex-1 justify-center">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Localização</p><p className="font-medium">{caminhao.localizacao || 'Pátio SOS'}</p></div>
            <div><p className="text-gray-400 text-xs">Quilometragem</p><p className="font-medium">{caminhaoSemKm(caminhao) ? 'Sem hodômetro' : `${(caminhaoKm(caminhao) || 0).toLocaleString('pt-BR')} km`}</p></div>
            {caminhao.ultimaManutencao && <div><p className="text-gray-400 text-xs">Última manutenção</p><p className="font-medium">{formatarData(caminhao.ultimaManutencao)}</p></div>}
            {caminhao.proximaPreventiva && <div><p className="text-gray-400 text-xs">Próxima preventiva</p><p className="font-medium">{formatarData(caminhao.proximaPreventiva)}</p></div>}
          </div>

          {caminhao.temDefeito && caminhao.defeito && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Defeito registrado</p>
              <p className="text-sm text-red-600">{caminhao.defeito}</p>
            </div>
          )}

          {podeEditar && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <button onClick={toggleDefeito}
                className={`flex-1 text-sm py-1.5 rounded-lg border font-medium transition-colors ${caminhao.temDefeito ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' : 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'}`}>
                {caminhao.temDefeito ? '✓ Resolver defeito' : '⚠ Marcar defeito'}
              </button>
              {podeVender && (
                <button onClick={marcarVendido} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  Vendido
                </button>
              )}
              {podeVender && (
                <button onClick={excluirCaminhao} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="font-semibold text-brand-black">Gerador montado</h2>
        </div>

        {gerMontado ? (
          <>
            <button onClick={() => navigate(`/geradores/${gerMontado.id}`)}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-brand-red hover:bg-red-50/30 transition-all">
              <div>
                <p className="font-bold text-brand-black">{gerMontado.codigo}</p>
                <p className="text-xs text-gray-500">{[gerMontado.potencia, gerMontado.marca].filter(Boolean).join(' • ')}</p>
              </div>
              <span className={`badge flex-shrink-0 ${statusGeradorCor(gerMontado.status)}`}>{statusGeradorLabel(gerMontado.status)}</span>
            </button>
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Quando este gerador vai a um evento ou locação, o caminhão acompanha automaticamente.
              Defeito ou manutenção do gerador <strong>não</strong> alteram o status do caminhão.
            </p>
            {podeEditar && (
              <button onClick={desvincularGerador} className="text-sm text-brand-red hover:underline">
                Remover vínculo
              </button>
            )}
          </>
        ) : podeEditar ? (
          <>
            <p className="text-sm text-gray-500">Vincule o gerador que fica montado em cima deste caminhão.</p>
            <input
              type="search"
              placeholder="Buscar gerador por código ou potência..."
              value={buscaGer}
              onChange={e => setBuscaGer(e.target.value)}
              className="input"
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {geradoresParaVincular.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">{buscaGer ? 'Nenhum gerador encontrado.' : 'Nenhum gerador disponível.'}</p>
              ) : geradoresParaVincular.map(g => (
                <button key={g.id} onClick={() => vincularGerador(g)} disabled={vinculando}
                  className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-100 hover:border-brand-red hover:bg-red-50/30 transition-all disabled:opacity-50">
                  <div>
                    <p className="font-semibold text-sm text-brand-black">{g.codigo}</p>
                    <p className="text-xs text-gray-400">{[g.potencia, g.marca].filter(Boolean).join(' • ')}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusGeradorCor(g.status)}`}>{statusGeradorLabel(g.status)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">Nenhum gerador montado.</p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-brand-black mb-3">Histórico de Manutenção ({historico.length})</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma OS registrada.</p>
        ) : (
          <div className="space-y-2">
            {historico.map(os => (
              <button key={os.id} onClick={() => navigate(`/manutencao/${os.id}`)}
                className="w-full text-left px-3 py-2 rounded-xl border border-gray-100 hover:border-brand-red hover:bg-red-50/30 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-brand-red">{os.numero}</p>
                    <p className="text-sm font-medium text-brand-black">{os.descricao}</p>
                    <p className="text-xs text-gray-400">{formatarData(os.dataAbertura)} • {os.tipo}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusOsCor(os.status)}`}>{statusOsLabel(os.status)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
