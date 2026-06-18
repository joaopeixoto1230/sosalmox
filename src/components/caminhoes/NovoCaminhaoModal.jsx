import { useState } from 'react'
import { db } from '../../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export default function NovoCaminhaoModal({ onFechar, onSalvo }) {
  const [form, setForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    ano: '',
    kmAtual: '',
    semKm: false,
    observacao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function salvar() {
    if (!form.placa.trim()) { setErro('A placa é obrigatória.'); return }
    setSalvando(true)
    setErro('')
    try {
      await addDoc(collection(db, 'caminhoes'), {
        placa: form.placa.trim().toUpperCase(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        ano: form.ano.trim(),
        status: 'disponivel',
        localizacao: 'Pátio SOS',
        semKm: form.semKm,
        kmAtual: form.semKm ? null : (form.kmAtual === '' ? null : Number(form.kmAtual)),
        observacao: form.observacao.trim(),
        temDefeito: false,
        defeito: '',
        eventoAtual: null,
        eventoNome: null,
        ultimaManutencao: null,
        proximaPreventiva: null,
        geradorMontadoId: null,
        geradorMontadoCodigo: null,
        fotoUrl: null,
        ativo: true,
        criadoEm: serverTimestamp(),
      })
      onSalvo?.()
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Novo Caminhão</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Placa *</label>
            <input value={form.placa} onChange={e => set('placa', e.target.value)}
              placeholder="Ex: ABC-1234" className="input" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Marca</label>
              <input value={form.marca} onChange={e => set('marca', e.target.value)}
                placeholder="Ex: Mercedes-Benz" className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => set('modelo', e.target.value)}
                placeholder="Ex: Atego 2426" className="input" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ano</label>
            <input value={form.ano} onChange={e => set('ano', e.target.value)}
              placeholder="Ex: 2018" className="input" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Quilometragem (KM)</label>
            <input
              type="number"
              min="0"
              value={form.semKm ? '' : form.kmAtual}
              onChange={e => set('kmAtual', e.target.value)}
              disabled={form.semKm}
              className="input disabled:bg-gray-100 disabled:text-gray-400"
              placeholder={form.semKm ? 'Sem hodômetro' : 'Ex: 125000'}
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.semKm}
                onChange={e => set('semKm', e.target.checked)}
                className="w-4 h-4 accent-brand-red"
              />
              <span className="text-sm text-gray-600">Este caminhão não tem hodômetro (KM)</span>
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação / função</label>
            <textarea
              value={form.observacao}
              onChange={e => set('observacao', e.target.value)}
              placeholder="Ex: Munck, Pranchão, Abastecimento..."
              rows={2}
              className="input resize-none"
            />
          </div>

          {erro && <p className="text-sm text-brand-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
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
