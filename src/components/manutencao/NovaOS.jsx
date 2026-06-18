import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, runTransaction, collection, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarNumeroOS } from '../../utils/formatters'

export default function NovaOS() {
  const navigate = useNavigate()
  const { uid, nome } = useAuth()
  const { dados: geradores } = useCollection('geradores')
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
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  const geradoresAtivos = useMemo(() => geradores.filter(g => g.ativo !== false && g.status !== 'inativo'), [geradores])

  function selecionarGerador(g) {
    set('equipamentoId', g.id)
    set('equipamentoLabel', `${g.codigo} — ${g.potencia || ''} ${g.marca || ''}`.trim())
  }

  async function confirmar() {
    if (!form.equipamentoLabel) { setErro('Selecione um equipamento.'); return }
    if (form.localTipo === 'locacao' && !form.clienteNome.trim()) { setErro('Informe o cliente da locação.'); return }
    if (!form.descricao.trim()) { setErro('Descreva o serviço a realizar.'); return }
    setSalvando(true); setErro('')
    try {
      const isGG = form.equipamentoTipo === 'gerador' && form.equipamentoId
      let eventoAtivo = false
      if (isGG) {
        const snap = await getDoc(doc(db, 'geradores', form.equipamentoId))
        eventoAtivo = snap.data()?.status === 'em_evento'
      }

      await runTransaction(db, async (tx) => {
        const contRef = doc(db, 'contadores', 'ordens_servico')
        const contSnap = await tx.get(contRef)
        const ultimo = contSnap.exists() ? (contSnap.data().ultimo || 0) : 0
        const proximo = ultimo + 1
        tx.set(contRef, { ultimo: proximo }, { merge: true })

        const osRef = doc(collection(db, 'ordens_servico'))
        tx.set(osRef, {
          numero: formatarNumeroOS(proximo),
          equipamentoId: form.equipamentoId,
          equipamentoTipo: form.equipamentoTipo,
          equipamentoLabel: form.equipamentoLabel,
          tipo: form.tipo,
          localTipo: form.localTipo,
          clienteNome: form.localTipo === 'locacao' ? form.clienteNome.trim() : null,
          localObra: form.localTipo === 'locacao' ? (form.localObra.trim() || null) : null,
          descricao: form.descricao,
          horimetroAbertura: form.horimetroAbertura ? parseInt(form.horimetroAbertura) : null,
          observacoes: form.observacoes,
          mecanicoUid: uid,
          mecanicoNome: nome,
          status: 'pendente',
          prioridade: eventoAtivo ? 'maxima' : 'normal',
          eventoAtivo,
          filtrosUsados: [],
          dataAbertura: serverTimestamp(),
          criadoEm: serverTimestamp(),
        })

        // gerador no pátio: marca em manutenção. Gerador em locação fica no cliente — não mexe no status/local.
        if (isGG && form.localTipo === 'patio') {
          tx.update(doc(db, 'geradores', form.equipamentoId), {
            status: 'manutencao',
            localizacao: 'Em manutenção',
          })
        }
      })
      navigate('/manutencao')
    } catch (e) {
      setErro(e.message || 'Erro ao abrir OS.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/manutencao')} className="btn-ghost px-2">←</button>
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Nova Ordem de Serviço</h1>
          <p className="text-gray-500 text-sm">Abre uma OS e atualiza o status do equipamento.</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de equipamento</label>
          <div className="flex gap-2">
            {[['gerador', 'Gerador (GG)'], ['caminhao', 'Caminhão'], ['empilhadeira', 'Empilhadeira']].map(([val, label]) => (
              <button key={val} onClick={() => { set('equipamentoTipo', val); set('equipamentoId', ''); set('equipamentoLabel', '') }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${form.equipamentoTipo === val ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.equipamentoTipo === 'gerador' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Gerador</label>
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
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do equipamento *</label>
            <input value={form.equipamentoLabel} onChange={e => { set('equipamentoLabel', e.target.value); set('equipamentoId', '') }}
              className="input" placeholder={form.equipamentoTipo === 'caminhao' ? 'Ex: Placa ABC-1234' : 'Ex: Empilhadeira 01'} />
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro atual</label>
          <input type="number" value={form.horimetroAbertura} onChange={e => set('horimetroAbertura', e.target.value)}
            className="input" placeholder="Ex: 12450" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
            rows={2} className="input resize-none" placeholder="Informações adicionais..." />
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/manutencao')} className="btn-secondary">Cancelar</button>
          <button onClick={confirmar} disabled={salvando} className="btn-primary flex-1 justify-center">
            {salvando ? 'Abrindo OS...' : 'Abrir Ordem de Serviço'}
          </button>
        </div>
      </div>
    </div>
  )
}
