import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase/config'
import { useCollection } from '../../../hooks/useFirestore'
import { useAuth } from '../../../contexts/AuthContext'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../../utils/formatters'

export default function StepEvento({ onSelecionar }) {
  const { tipoPerfil } = useAuth()
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')
  const [criandoEvento, setCriandoEvento] = useState(false)
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const podeGerenciar = ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)

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

  async function excluirEvento() {
    if (!excluindo) return
    try {
      await deleteDoc(doc(db, 'eventos', excluindo.id))
      setExcluindo(null)
    } catch (e) {
      console.error(e)
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
            <div key={evt.id} className="card hover:border-brand-red hover:shadow-md transition-all group flex items-start gap-3">
              <button
                onClick={() => onSelecionar(evt)}
                className="flex-1 text-left min-w-0"
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

              {podeGerenciar && (
                <MenuEvento
                  onEditar={() => setEditando(evt)}
                  onExcluir={() => setExcluindo(evt)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {editando && (
        <ModalEditarEvento
          evento={editando}
          onFechar={() => setEditando(null)}
        />
      )}

      {excluindo && (
        <ModalConfirmarExclusao
          evento={excluindo}
          onConfirmar={excluirEvento}
          onFechar={() => setExcluindo(null)}
        />
      )}
    </div>
  )
}

function MenuEvento({ onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function fechar(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false)
    }
    if (aberto) document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setAberto(v => !v) }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-8 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
          <button
            onClick={e => { e.stopPropagation(); setAberto(false); onEditar() }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
          <button
            onClick={e => { e.stopPropagation(); setAberto(false); onExcluir() }}
            className="w-full text-left px-4 py-2 text-sm text-brand-red hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
        </div>
      )}
    </div>
  )
}

function ModalEditarEvento({ evento, onFechar }) {
  const [form, setForm] = useState({ nome: evento.nome, local: evento.local, data: evento.data })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'eventos', evento.id), {
        nome: form.nome.trim(),
        local: form.local.trim(),
        data: form.data,
      })
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">Editar evento</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do evento *</label>
            <input className="input w-full" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local *</label>
            <input className="input w-full" value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input type="date" className="input w-full" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
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

function ModalConfirmarExclusao({ evento, onConfirmar, onFechar }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-brand-black">Excluir evento</p>
            <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <strong>{evento.nome}</strong> — {evento.local}
        </p>
        <div className="flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onConfirmar} className="flex-1 px-4 py-2 bg-brand-red text-white rounded-xl font-medium text-sm hover:bg-red-700 transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
