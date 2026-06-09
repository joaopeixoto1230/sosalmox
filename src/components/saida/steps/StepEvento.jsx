import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase/config'

const OPERADORES = [
  'Adjaiton',
  'Adriano',
  'Bruno',
  'Fabio',
  'Francisco Chaguas',
  'França',
  'Gerson',
  'Igor',
  'João Felipe',
  'Laercio',
  'Marcio',
  'Maycon Souza',
  'Maycon Teixeira',
  'Nilton',
  'Ricardo',
  'Robson',
  'Ronaldo',
]

export default function StepEvento({ onSelecionar, onResponsavel }) {
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [operador, setOperador] = useState('')
  const [outroNome, setOutroNome] = useState('')
  const [mostrarOutro, setMostrarOutro] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const responsavelFinal = mostrarOutro ? outroNome.trim() : operador

  async function criarEvento() {
    if (!form.nome.trim()) { setErro('Nome do evento é obrigatório'); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!responsavelFinal) { setErro('Selecione o responsável pelo material'); return }
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
      onResponsavel(responsavelFinal)
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Responsável pelo material *</label>
          <div className="flex flex-wrap gap-2">
            {OPERADORES.map(nome => (
              <button
                key={nome}
                type="button"
                onClick={() => { setOperador(nome); setMostrarOutro(false) }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                  operador === nome && !mostrarOutro
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand-red hover:text-brand-red'
                }`}
              >
                {nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setMostrarOutro(true); setOperador('') }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                mostrarOutro
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-brand-red hover:text-brand-red'
              }`}
            >
              + Outro
            </button>
          </div>
          {mostrarOutro && (
            <input
              value={outroNome}
              onChange={e => setOutroNome(e.target.value)}
              placeholder="Digite o nome..."
              className="input mt-2"
              autoFocus
            />
          )}
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
