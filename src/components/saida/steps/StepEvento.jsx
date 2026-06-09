import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase/config'

export default function StepEvento({ onSelecionar }) {
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function criarEvento() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    setSalvando(true)
    setErro('')
    try {
      const ref = await addDoc(collection(db, 'eventos'), {
        nome: form.nome.trim(),
        local: form.local.trim(),
        data: form.data,
        status: 'ativo',
        criadoEm: serverTimestamp(),
      })
      onSelecionar({ id: ref.id, nome: form.nome.trim(), local: form.local.trim(), data: form.data, status: 'ativo' })
    } catch (e) {
      setErro('Erro ao criar evento: ' + e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">Novo Evento</h2>
        <p className="text-sm text-gray-500">Preencha os dados do evento para iniciar a saída.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do evento *</label>
          <input
            value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            placeholder="Ex: Evento FIOTEC"
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Local *</label>
          <input
            value={form.local}
            onChange={e => setForm(p => ({ ...p, local: e.target.value }))}
            placeholder="Ex: Brasília - DF"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input
            type="date"
            value={form.data}
            onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
            className="input"
          />
        </div>

        {erro && <p className="text-sm text-brand-red">{erro}</p>}

        <button
          onClick={criarEvento}
          disabled={salvando}
          className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50"
        >
          {salvando ? 'Criando evento...' : 'Criar e Continuar →'}
        </button>
      </div>
    </div>
  )
}
