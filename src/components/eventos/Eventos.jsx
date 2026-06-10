import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../utils/formatters'
import DatePicker from '../ui/DatePicker'

const STATUS_FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'agendado', label: 'Agendados' },
  { value: 'concluido', label: 'Concluídos' },
]

export default function Eventos() {
  const { tipoPerfil } = useAuth()
  const navigate = useNavigate()
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [detalheEvento, setDetalheEvento] = useState(null)
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
      const batch = writeBatch(db)

      const materiaisSnap = await getDocs(query(collection(db, 'materiais'), where('eventoAtual', '==', excluindo.id)))
      materiaisSnap.forEach(d => {
        batch.update(d.ref, { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
      })

      const geradoresSnap = await getDocs(query(collection(db, 'geradores'), where('eventoAtual', '==', excluindo.id)))
      geradoresSnap.forEach(d => {
        batch.update(d.ref, { status: 'disponivel', eventoAtual: null })
      })

      const ordensSnap = await getDocs(query(collection(db, 'ordens_saida'), where('eventoId', '==', excluindo.id)))
      ordensSnap.forEach(d => batch.delete(d.ref))

      batch.delete(doc(db, 'eventos', excluindo.id))
      await batch.commit()
      setExcluindo(null)
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
          <button onClick={() => navigate('/saida', { state: { abrirCriarEvento: true } })} className="btn-primary flex-shrink-0">
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

function EventoCard({ evento, podeGerenciar, onClick, onEditar, onExcluir }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [totalSaidas, setTotalSaidas] = useState(null)
  const [editandoMaterial, setEditandoMaterial] = useState(false)
  const [concluindoEvento, setConcluindoEvento] = useState(false)

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
    <>
    {editandoMaterial && (
      <ModalEditarMaterialEvento evento={evento} onFechar={() => setEditandoMaterial(false)} />
    )}
    {concluindoEvento && (
      <ModalConcluirEvento evento={evento} onFechar={() => setConcluindoEvento(false)} onConcluido={() => setConcluindoEvento(false)} />
    )}
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
                  <button
                    onClick={() => { setMenuAberto(false); setEditandoMaterial(true) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                    Editar material
                  </button>
                  {evento.status !== 'concluido' && (
                    <button
                      onClick={() => { setMenuAberto(false); setConcluindoEvento(true) }}
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
    </>
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
    const dataEvento = evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

    const blocoOrdens = ordens.map(o => {
      const itensLinhas = (o.itens || []).map((item, idx) =>
        `<tr class="${idx % 2 === 0 ? 'row-par' : ''}">
          <td>${item.nome}</td>
          <td class="mono">${item.codigo}</td>
          <td>${item.categoria || '—'}</td>
        </tr>`
      ).join('')

      return `
        <div class="ordem">
          <div class="ordem-header">
            <span class="ordem-num">${o.numeroFormatado}</span>
            <div class="ordem-pessoas">
              <span class="pessoa"><span class="label">Entregou:</span> ${o.operadorNome || '—'}</span>
              <span class="separador">·</span>
              <span class="pessoa"><span class="label">Recebeu:</span> ${o.responsavelNome || '—'}</span>
              ${o.geradorCodigo ? `<span class="separador">·</span><span class="pessoa"><span class="label">Gerador:</span> ${o.geradorCodigo}</span>` : ''}
            </div>
          </div>
          <table>
            <thead><tr><th>Material</th><th>Código</th><th>Categoria</th></tr></thead>
            <tbody>${itensLinhas}</tbody>
          </table>
          ${o.observacoes ? `<p class="obs">"${o.observacoes}"</p>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório — ${evento.nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: #fff; padding: 32px; font-size: 13px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #CC0000; padding-bottom: 16px; margin-bottom: 20px; }
    .header-left h1 { font-size: 22px; color: #CC0000; font-weight: 800; letter-spacing: -0.5px; }
    .header-left p { color: #666; font-size: 12px; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .evento-nome { font-size: 16px; font-weight: 700; color: #1a1a1a; }
    .header-right .evento-info { font-size: 12px; color: #666; margin-top: 3px; }

    .resumo { display: flex; gap: 12px; margin-bottom: 24px; }
    .resumo-box { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; text-align: center; }
    .resumo-box .num { font-size: 22px; font-weight: 800; color: #1a1a1a; }
    .resumo-box .desc { font-size: 11px; color: #888; margin-top: 2px; }

    .ordem { margin-bottom: 20px; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
    .ordem-header { background: #f8f8f8; padding: 10px 14px; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
    .ordem-num { font-weight: 800; color: #CC0000; font-size: 14px; }
    .ordem-pessoas { font-size: 12px; color: #555; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .label { color: #999; font-weight: normal; }
    .pessoa { font-weight: 600; }
    .separador { color: #ccc; }

    table { width: 100%; border-collapse: collapse; }
    th { background: #fff; text-align: left; padding: 8px 14px; font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e5e5; }
    td { padding: 8px 14px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    .row-par td { background: #fafafa; }
    .mono { font-family: monospace; font-size: 12px; color: #CC0000; }
    .obs { padding: 8px 14px; font-size: 12px; color: #888; font-style: italic; background: #fffbf0; border-top: 1px solid #f0e8c8; }

    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
    .total { font-size: 13px; font-weight: 700; color: #1a1a1a; }

    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>SOS Energia</h1>
      <p>Relatório de Saída de Material</p>
    </div>
    <div class="header-right">
      <div class="evento-nome">${evento.nome}</div>
      <div class="evento-info">${evento.local} &nbsp;·&nbsp; ${dataEvento}</div>
    </div>
  </div>

  <div class="resumo">
    <div class="resumo-box"><div class="num">${ordens.length}</div><div class="desc">Saídas</div></div>
    <div class="resumo-box"><div class="num">${totalItens}</div><div class="desc">Materiais</div></div>
    <div class="resumo-box"><div class="num">${geradores.length}</div><div class="desc">Geradores</div></div>
  </div>

  ${blocoOrdens || '<p style="color:#888;text-align:center;padding:20px">Nenhuma saída registrada.</p>'}

  <div class="footer">
    <span class="total">Total: ${totalItens} ${totalItens === 1 ? 'item' : 'itens'} em ${ordens.length} ${ordens.length === 1 ? 'saída' : 'saídas'}</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`

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
                  <div key={ordem.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-red text-sm">{ordem.numeroFormatado}</span>
                      {ordem.geradorCodigo && (
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{ordem.geradorCodigo}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {ordem.operadorNome && (
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <p className="text-xs text-gray-400 mb-0.5">Entregou</p>
                          <p className="text-xs font-semibold text-brand-black">{ordem.operadorNome}</p>
                        </div>
                      )}
                      {ordem.responsavelNome && (
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <p className="text-xs text-gray-400 mb-0.5">Recebeu</p>
                          <p className="text-xs font-semibold text-brand-black">{ordem.responsavelNome}</p>
                        </div>
                      )}
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
                      <p className="text-xs text-gray-500 italic">"{ordem.observacoes}"</p>
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
            <DatePicker value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} className="w-full" />
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

const STATUS_DEVOLUCAO = [
  { value: 'disponivel', label: 'Devolvido', inativo: 'bg-green-50 text-green-700 border-green-200', ativo: 'bg-green-500 text-white border-green-500' },
  { value: 'manutencao', label: 'Manutenção', inativo: 'bg-blue-50 text-blue-700 border-blue-200', ativo: 'bg-blue-500 text-white border-blue-500' },
  { value: 'perdido', label: 'Perdido', inativo: 'bg-red-50 text-red-700 border-red-200', ativo: 'bg-red-500 text-white border-red-500' },
]

function ModalConcluirEvento({ evento, onFechar, onConcluido }) {
  const { dados: todosMateriais, carregando } = useCollection('materiais')
  const [statusMap, setStatusMap] = useState({})
  const [concluindo, setConcluindo] = useState(false)

  const materiaisDoEvento = todosMateriais.filter(m => m.eventoAtual === evento.id)

  function getStatus(id) { return statusMap[id] || 'disponivel' }
  function setStatus(id, val) { setStatusMap(prev => ({ ...prev, [id]: val })) }

  const resumo = {
    devolvidos: materiaisDoEvento.filter(m => getStatus(m.id) === 'disponivel').length,
    manutencao: materiaisDoEvento.filter(m => getStatus(m.id) === 'manutencao').length,
    perdidos: materiaisDoEvento.filter(m => getStatus(m.id) === 'perdido').length,
  }

  async function confirmar() {
    setConcluindo(true)
    try {
      const batch = writeBatch(db)

      materiaisDoEvento.forEach(m => {
        const novoStatus = getStatus(m.id)
        batch.update(doc(db, 'materiais', m.id), {
          status: novoStatus,
          estoqueAtual: novoStatus === 'disponivel' ? 1 : 0,
          eventoAtual: null,
        })
      })

      const geradoresSnap = await getDocs(query(collection(db, 'geradores'), where('eventoAtual', '==', evento.id)))
      geradoresSnap.forEach(d => batch.update(d.ref, { status: 'disponivel', eventoAtual: null }))

      batch.update(doc(db, 'eventos', evento.id), { status: 'concluido' })

      await batch.commit()
      onConcluido()
    } catch (e) {
      console.error(e)
      setConcluindo(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Concluir evento</h2>
            <p className="text-xs text-gray-500 mt-0.5">Confirme o retorno de cada material</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2.5">
          {carregando ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : materiaisDoEvento.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Nenhum material vinculado a este evento.</p>
              <p className="text-xs mt-1">O evento será marcado como concluído.</p>
            </div>
          ) : (
            materiaisDoEvento.map(m => (
              <div key={m.id} className="border border-gray-100 rounded-xl p-3 space-y-2.5">
                <div>
                  <p className="text-sm font-semibold text-brand-black">{m.nome}</p>
                  <p className="text-xs text-gray-400 font-mono">{m.codigo}</p>
                </div>
                <div className="flex gap-1.5">
                  {STATUS_DEVOLUCAO.map(op => {
                    const ativo = getStatus(m.id) === op.value
                    return (
                      <button
                        key={op.value}
                        onClick={() => setStatus(m.id, op.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ativo ? op.ativo : op.inativo}`}
                      >
                        {op.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {materiaisDoEvento.length > 0 && (
          <div className="px-5 pt-3 pb-2 flex gap-4 justify-center">
            <span className="text-xs text-green-600 font-semibold">{resumo.devolvidos} devolvidos</span>
            {resumo.manutencao > 0 && <span className="text-xs text-blue-600 font-semibold">{resumo.manutencao} manutenção</span>}
            {resumo.perdidos > 0 && <span className="text-xs text-brand-red font-semibold">{resumo.perdidos} perdidos</span>}
          </div>
        )}

        <div className="px-5 pb-5 pt-2 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={confirmar}
            disabled={concluindo}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {concluindo ? 'Concluindo...' : 'Concluir evento ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CATEGORIAS_MAT = ['Todos', 'Cabos 4x', 'Cabos 5x', 'Cabos Terra', 'Cabos (Geral)', 'Jogos de Cabo', 'Rabichos', 'Outros Materiais']

function ModalEditarMaterialEvento({ evento, onFechar }) {
  const { dados: todosMateriais, carregando } = useCollection('materiais')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [processando, setProcessando] = useState(null)

  const materiaisDoEvento = todosMateriais.filter(m => m.eventoAtual === evento.id)
  const disponiveisFiltrados = todosMateriais.filter(m => {
    if (m.status !== 'disponivel') return false
    if (categoria !== 'Todos' && m.categoria !== categoria) return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q)
  })

  async function remover(material) {
    setProcessando(material.id)
    try {
      await updateDoc(doc(db, 'materiais', material.id), { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
    } catch (e) { console.error(e) }
    finally { setProcessando(null) }
  }

  async function adicionar(material) {
    setProcessando(material.id)
    try {
      await updateDoc(doc(db, 'materiais', material.id), { status: 'em_evento', estoqueAtual: 0, eventoAtual: evento.id })
    } catch (e) { console.error(e) }
    finally { setProcessando(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Editar material</h2>
            <p className="text-xs text-gray-500 mt-0.5">{evento.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              No evento ({materiaisDoEvento.length})
            </p>
            {carregando ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : materiaisDoEvento.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Nenhum material vinculado a este evento.</p>
            ) : (
              <div className="space-y-2">
                {materiaisDoEvento.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-black truncate">{m.nome}</p>
                      <p className="text-xs text-gray-500 font-mono">{m.codigo}</p>
                    </div>
                    <button
                      onClick={() => remover(m)}
                      disabled={processando === m.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-white border border-red-200 text-brand-red rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {processando === m.id ? '...' : 'Retirar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Disponíveis para adicionar
            </p>
            <input
              type="search"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input w-full mb-2"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {CATEGORIAS_MAT.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoria(cat)}
                  className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-medium transition-colors
                    ${categoria === cat ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {carregando ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : disponiveisFiltrados.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{busca ? 'Nenhum resultado para a busca.' : 'Nenhum material disponível.'}</p>
            ) : (
              <div className="space-y-2">
                {disponiveisFiltrados.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-black truncate">{m.nome}</p>
                      <p className="text-xs text-gray-500 font-mono">{m.codigo}</p>
                    </div>
                    <button
                      onClick={() => adicionar(m)}
                      disabled={processando === m.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40"
                    >
                      {processando === m.id ? '...' : 'Adicionar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={onFechar} className="btn-primary w-full justify-center">Fechar</button>
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
