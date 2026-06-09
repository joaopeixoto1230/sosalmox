import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../utils/formatters'

const STATUS_FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'agendado', label: 'Agendados' },
  { value: 'concluido', label: 'Concluídos' },
]

export default function Eventos() {
  const { tipoPerfil } = useAuth()
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [detalheEvento, setDetalheEvento] = useState(null)
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const podeGerenciar = ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)

  const filtrados = eventos
    .filter(e => filtroStatus === 'todos' || e.status === filtroStatus)
    .filter(e =>
      e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.local || '').toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => new Date(b.data) - new Date(a.data))

  const stats = {
    total: eventos.length,
    ativos: eventos.filter(e => e.status === 'ativo').length,
    agendados: eventos.filter(e => e.status === 'agendado').length,
    concluidos: eventos.filter(e => e.status === 'concluido').length,
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

  async function concluirEvento(evt) {
    try {
      await updateDoc(doc(db, 'eventos', evt.id), { status: 'concluido' })
    } catch (e) {
      console.error(e)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Eventos</h1>
          <p className="text-gray-500 text-sm mt-1">Histórico completo de todos os eventos.</p>
        </div>
        {podeGerenciar && (
          <button onClick={() => setCriando(true)} className="btn-primary flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo evento
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, cor: 'text-brand-black' },
          { label: 'Ativos', value: stats.ativos, cor: 'text-green-600' },
          { label: 'Agendados', value: stats.agendados, cor: 'text-blue-600' },
          { label: 'Concluídos', value: stats.concluidos, cor: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${s.cor}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Buscar por nome ou local..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input flex-1"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroStatus(f.value)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-colors
                ${filtroStatus === f.value ? 'bg-brand-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-14 h-14 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm mt-1">Tente outro filtro ou crie um novo evento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(evt => (
            <EventoCard
              key={evt.id}
              evento={evt}
              podeGerenciar={podeGerenciar}
              onClick={() => setDetalheEvento(evt)}
              onEditar={() => setEditando(evt)}
              onExcluir={() => setExcluindo(evt)}
              onConcluir={() => concluirEvento(evt)}
            />
          ))}
        </div>
      )}

      {detalheEvento && (
        <ModalDetalheEvento
          evento={detalheEvento}
          onFechar={() => setDetalheEvento(null)}
        />
      )}

      {criando && (
        <ModalFormEvento
          onFechar={() => setCriando(false)}
          onSalvar={() => setCriando(false)}
        />
      )}

      {editando && (
        <ModalFormEvento
          evento={editando}
          onFechar={() => setEditando(null)}
          onSalvar={() => setEditando(null)}
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

function EventoCard({ evento, podeGerenciar, onClick, onEditar, onExcluir, onConcluir }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [totalSaidas, setTotalSaidas] = useState(null)

  useEffect(() => {
    async function buscar() {
      try {
        const q = query(collection(db, 'ordens_saida'), where('eventoId', '==', evento.id))
        const snap = await getDocs(q)
        setTotalSaidas(snap.size)
      } catch { setTotalSaidas(0) }
    }
    buscar()
  }, [evento.id])

  return (
    <div
      className="card hover:border-brand-red hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-brand-black truncate">{evento.nome}</p>
            <span className={`badge flex-shrink-0 ${statusEventoCor(evento.status)}`}>
              {statusEventoLabel(evento.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {evento.local}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-xs text-gray-400">{formatarData(evento.data)}</p>
            {totalSaidas !== null && (
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                {totalSaidas} {totalSaidas === 1 ? 'saída' : 'saídas'}
              </span>
            )}
          </div>
        </div>

        {podeGerenciar && (
          <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => { e.stopPropagation(); setMenuAberto(v => !v) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                  <button
                    onClick={() => { setMenuAberto(false); onEditar() }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  {evento.status !== 'concluido' && (
                    <button
                      onClick={() => { setMenuAberto(false); onConcluir() }}
                      className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Marcar concluído
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuAberto(false); onExcluir() }}
                    className="w-full text-left px-4 py-2 text-sm text-brand-red hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalDetalheEvento({ evento, onFechar }) {
  const [ordens, setOrdens] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function buscarOrdens() {
      try {
        const q = query(collection(db, 'ordens_saida'), where('eventoId', '==', evento.id))
        const snap = await getDocs(q)
        const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        dados.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
        setOrdens(dados)
      } catch (e) {
        console.error(e)
      } finally {
        setCarregando(false)
      }
    }
    buscarOrdens()
  }, [evento.id])

  const totalItens = ordens.reduce((acc, o) => acc + (o.itens?.length || 0), 0)
  const geradores = [...new Set(ordens.filter(o => o.geradorCodigo).map(o => o.geradorCodigo))]

  function imprimir() {
    const linhas = ordens.flatMap(o =>
      (o.itens || []).map(item =>
        `<tr><td>${o.numeroFormatado}</td><td>${item.nome}</td><td>${item.codigo}</td><td>${item.categoria || '—'}</td><td>${o.geradorCodigo || '—'}</td><td>${o.operadorNome || '—'}</td></tr>`
      )
    ).join('')
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>Relatório — ${evento.nome}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px}h1{color:#CC0000;margin:0 0 4px}
      .info{color:#555;font-size:14px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f0f0f0;text-align:left;padding:8px 10px;border-bottom:2px solid #ccc}
      td{padding:7px 10px;border-bottom:1px solid #e5e5e5}
      .footer{margin-top:20px;font-size:12px;color:#888}
      @media print{body{padding:0}}</style>
      </head><body>
      <h1>SOS Energia — Relatório de Evento</h1>
      <div class="info"><strong>${evento.nome}</strong> · ${evento.local} · ${evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
      <table><thead><tr><th>Ordem</th><th>Material</th><th>Código</th><th>Categoria</th><th>Gerador</th><th>Operador</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6">Nenhuma saída registrada.</td></tr>'}</tbody></table>
      <p style="font-weight:bold;margin-top:12px">Total: ${totalItens} ${totalItens === 1 ? 'item' : 'itens'} em ${ordens.length} ${ordens.length === 1 ? 'saída' : 'saídas'}</p>
      <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
      </body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">{evento.nome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{evento.local} · {evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-brand-black">{ordens.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Saídas</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-brand-black">{totalItens}</p>
              <p className="text-xs text-gray-500 mt-0.5">Materiais</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-brand-black">{geradores.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Geradores</p>
            </div>
          </div>

          {geradores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Geradores</p>
              <div className="flex flex-wrap gap-2">
                {geradores.map(g => (
                  <span key={g} className="px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-semibold rounded-lg">{g}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Histórico de saídas</p>
            {carregando ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ordens.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">Nenhuma saída registrada para este evento.</p>
            ) : (
              <div className="space-y-3">
                {ordens.map(ordem => (
                  <div key={ordem.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-brand-red text-sm">{ordem.numeroFormatado}</span>
                      <div className="flex items-center gap-2">
                        {ordem.geradorCodigo && (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{ordem.geradorCodigo}</span>
                        )}
                        <span className="text-xs text-gray-400">{ordem.operadorNome}</span>
                      </div>
                    </div>
                    {ordem.itens?.length > 0 && (
                      <div className="space-y-1">
                        {ordem.itens.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="truncate">{item.nome}</span>
                            <span className="text-gray-400 font-mono flex-shrink-0">{item.codigo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ordem.observacoes && (
                      <p className="text-xs text-gray-500 mt-2 italic">"{ordem.observacoes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1">Fechar</button>
          <button onClick={imprimir} className="btn-primary flex-1 justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Gerar Relatório
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalFormEvento({ evento, onFechar, onSalvar }) {
  const [form, setForm] = useState({
    nome: evento?.nome || '',
    local: evento?.local || '',
    data: evento?.data || '',
    status: evento?.status || 'ativo',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    setSalvando(true)
    setErro('')
    try {
      if (evento) {
        await updateDoc(doc(db, 'eventos', evento.id), {
          nome: form.nome.trim(),
          local: form.local.trim(),
          data: form.data,
          status: form.status,
        })
      } else {
        await addDoc(collection(db, 'eventos'), {
          nome: form.nome.trim(),
          local: form.local.trim(),
          data: form.data,
          status: form.status,
          criadoEm: serverTimestamp(),
        })
      }
      onSalvar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-brand-black">{evento ? 'Editar evento' : 'Novo evento'}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="input w-full" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="ativo">Ativo</option>
              <option value="agendado">Agendado</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
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
