import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useCollection } from '../../../hooks/useFirestore'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../../utils/formatters'

export default function StepEvento({ onSelecionar }) {
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')
  const [criandoEvento, setCriandoEvento] = useState(false)
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const filtrados = eventos
    .filter(e => ['ativo', 'agendado'].includes(e.status))
    .filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.local.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => new Date(a.data) - new Date(b.data))

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

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">Selecionar Evento</h2>
        <p className="text-sm text-gray-500">Escolha o evento para registrar a saída de material.</p>
      </div>

      {criandoEvento ? (
        <div className="card border-brand-red border space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-brand-black text-sm">Novo Evento</p>
            <button onClick={() => { setCriandoEvento(false); setErro('') }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome do evento *</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Evento FIOTEC" className="input" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Local *</label>
            <input value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))}
              placeholder="Ex: Brasília - DF" className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data *</label>
            <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className="input" />
          </div>
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setCriandoEvento(false); setErro('') }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={criarEvento} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Criando...' : 'Criar e Selecionar'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCriandoEvento(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-red hover:text-brand-red transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar novo evento
        </button>
      )}

      <input
        type="search"
        placeholder="Buscar evento por nome ou local..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="input"
      />

      {filtrados.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm">Crie um novo evento acima ou verifique o status.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(evt => (
            <button
              key={evt.id}
              onClick={() => onSelecionar(evt)}
              className="card text-left hover:border-brand-red hover:shadow-md transition-all group w-full"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-black group-hover:text-brand-red transition-colors truncate">
                    {evt.nome}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {evt.local}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatarData(evt.data)}</p>
                </div>
                <span className={`badge flex-shrink-0 ${statusEventoCor(evt.status)}`}>
                  {statusEventoLabel(evt.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
