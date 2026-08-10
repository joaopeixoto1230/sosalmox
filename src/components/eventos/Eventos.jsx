import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { statusEventoCor, statusEventoLabel, statusGeradorLabel } from '../../utils/formatters'
import { gerarDeclaracaoSublocacao } from '../../utils/declaracaoSublocacao'
import DatePicker from '../ui/DatePicker'
import SignaturePad from '../ui/SignaturePad'

const STATUS_FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'agendado', label: 'Agendados' },
  { value: 'concluido', label: 'Concluídos' },
]

// Documento de `eventos` sem o campo `tipo` conta como evento — mesma convencao
// do `tipo` em ordens_saida (uso interno), sem migracao de dados.
const ehLocacao = e => e.tipo === 'locacao_mensal'
const ehSublocacao = e => e.tipo === 'sublocacao'

// Os botões mudam conforme a porta de entrada: em /eventos você separa evento
// de locação; em /locacoes, mensal de sublocação.
const FILTROS_EVENTO = [
  { value: 'todos', label: 'Tudo' },
  { value: 'evento', label: 'Eventos' },
  { value: 'locacoes', label: 'Locações' },
]
const FILTROS_LOCACAO = [
  { value: 'locacoes', label: 'Todas' },
  { value: 'locacao_mensal', label: 'Mensais' },
  { value: 'sublocacao', label: 'Sublocações' },
]
const FILTROS_PORTA = {
  evento: FILTROS_EVENTO,
  locacoes: FILTROS_LOCACAO,
  locacao_mensal: FILTROS_LOCACAO,
  sublocacao: FILTROS_LOCACAO,
}

// 'evento' = qualquer documento sem tipo; 'locacoes' = mensal + sublocação.
function daCategoria(e, filtro) {
  if (filtro === 'todos') return true
  if (filtro === 'evento') return !e.tipo
  if (filtro === 'locacoes') return e.tipo === 'locacao_mensal' || e.tipo === 'sublocacao'
  return e.tipo === filtro
}

// A tela atende duas portas do menu: /eventos e /locacoes. É o MESMO componente
// com o filtro pré-aplicado — nada é duplicado, então detalhe, relatório,
// conclusão e exclusão continuam existindo em um só lugar.
const TITULOS = {
  evento: {
    titulo: 'Eventos',
    sub: 'Histórico completo de todos os eventos.',
    vazio: 'Nenhum evento encontrado',
    botao: 'Novo evento',
  },
  locacoes: {
    titulo: 'Locações',
    sub: 'Locações mensais e sublocações em andamento.',
    vazio: 'Nenhuma locação encontrada',
    botao: 'Nova locação',
  },
  locacao_mensal: {
    titulo: 'Locações mensais',
    sub: 'Contratos mensais com cliente final.',
    vazio: 'Nenhuma locação mensal encontrada',
    botao: 'Nova locação',
  },
  sublocacao: {
    titulo: 'Sublocações',
    sub: 'Equipamento alugado para outras empresas.',
    vazio: 'Nenhuma sublocação encontrada',
    botao: 'Nova sublocação',
  },
}

export default function Eventos({ filtroInicial = 'evento' }) {
  const { tipoPerfil } = useAuth()
  const navigate = useNavigate()
  const { dados: eventos, carregando } = useCollection('eventos')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState(filtroInicial)
  const txt = TITULOS[filtroInicial] || TITULOS.evento
  const filtros = FILTROS_PORTA[filtroInicial] || FILTROS_PORTA.evento
  const [detalheEvento, setDetalheEvento] = useState(null)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const podeGerenciar = ['admin', 'gerente', 'almoxarife'].includes(tipoPerfil)

  const filtrados = eventos
    .filter(e => filtroStatus === 'todos' || e.status === filtroStatus)
    .filter(e => daCategoria(e, filtroTipo))
    .filter(e =>
      e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.local || '').toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => new Date(b.data) - new Date(a.data))

  // As estatisticas seguem o filtro de tipo, para "Locações" mostrar o numero
  // de locacoes e nao o total geral.
  const doTipo = eventos.filter(e => daCategoria(e, filtroTipo))

  const stats = {
    total: doTipo.length,
    ativos: doTipo.filter(e => e.status === 'ativo').length,
    agendados: doTipo.filter(e => e.status === 'agendado').length,
    concluidos: doTipo.filter(e => e.status === 'concluido').length,
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
        batch.update(d.ref, { status: 'disponivel', eventoAtual: null, eventoNome: null, localizacao: 'Pátio SOS' })
      })

      const ordensSnap = await getDocs(query(collection(db, 'ordens_saida'), where('eventoId', '==', excluindo.id)))
      ordensSnap.forEach(d => batch.delete(d.ref))

      // remove tambem as fotos das saidas (fotos_saida) dessas ordens
      const ordemIds = ordensSnap.docs.map(d => d.id)
      for (let i = 0; i < ordemIds.length; i += 10) {
        const lote = ordemIds.slice(i, i + 10)
        const fotosSnap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', 'in', lote)))
        fotosSnap.forEach(d => batch.delete(d.ref))
      }

      // remove os documentos de assinatura (assinaturas_saida) dessas ordens
      ordensSnap.docs.forEach(d => {
        const token = d.data().tokenAssinatura
        if (token) batch.delete(doc(db, 'assinaturas_saida', token))
      })

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
          <h1 className="text-2xl font-bold text-brand-black">{txt.titulo}</h1>
          <p className="text-gray-500 text-sm mt-1">{txt.sub}</p>
        </div>
        {podeGerenciar && (
          <button onClick={() => navigate('/saida', { state: { abrirCriarEvento: true } })} className="btn-primary flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {txt.botao}
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

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroTipo(f.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors
              ${filtroTipo === f.value
                ? (f.value === 'locacao_mensal' || f.value === 'locacoes' ? 'bg-purple-600 text-white'
                  : f.value === 'sublocacao' ? 'bg-teal-600 text-white'
                  : 'bg-brand-black text-white')
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
          >
            {f.label}
          </button>
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
          <p className="font-medium">{txt.vazio}</p>
          <p className="text-sm mt-1">Tente outro filtro ou lance uma nova saída.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
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
  const [editandoGerador, setEditandoGerador] = useState(false)
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
    {editandoGerador && (
      <ModalEditarGeradorEvento evento={evento} onFechar={() => setEditandoGerador(false)} />
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
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <p className="font-semibold text-brand-black truncate">{evento.nome}</p>
            {ehLocacao(evento) && (
              <span className="badge bg-purple-100 text-purple-700 flex-shrink-0">Locação</span>
            )}
            {ehSublocacao(evento) && (
              <span className="badge bg-teal-100 text-teal-700 flex-shrink-0">Sublocação</span>
            )}
          </div>
          {ehSublocacao(evento) && evento.retiradoPor && (
            <p className="text-xs text-teal-700 mb-1 truncate">Retirado por {evento.retiradoPor}</p>
          )}
          <p className="text-sm text-gray-500 flex items-center gap-1 min-w-0">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="truncate min-w-0">{evento.local}</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-xs text-gray-400">{evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
            {totalSaidas !== null && (
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                {totalSaidas} {totalSaidas === 1 ? 'saída' : 'saídas'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`badge ${statusEventoCor(evento.status)}`}>
            {statusEventoLabel(evento.status)}
          </span>
          {podeGerenciar && (
          <div className="relative" onClick={e => e.stopPropagation()}>
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
                  <button
                    onClick={() => { setMenuAberto(false); setEditandoGerador(true) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Editar geradores
                  </button>
                  {evento.status !== 'concluido' && (
                    <button
                      onClick={() => { setMenuAberto(false); setConcluindoEvento(true) }}
                      className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {ehSublocacao(evento) ? 'Encerrar sublocação' : ehLocacao(evento) ? 'Encerrar locação' : 'Marcar concluído'}
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
    </div>
    </>
  )
}

// Extrai todos os codigos de gerador de uma ordem. Ordens novas guardam o array
// `geradores`; ordens antigas so tinham `geradorCodigo` (1 gerador) — fallback.
function codigosGeradoresDaOrdem(o) {
  if (Array.isArray(o.geradores) && o.geradores.length > 0) {
    return o.geradores.map(g => g.codigo).filter(Boolean)
  }
  return o.geradorCodigo ? [o.geradorCodigo] : []
}

function ModalDetalheEvento({ evento, onFechar }) {
  const [ordens, setOrdens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [fotosPorOrdem, setFotosPorOrdem] = useState({})
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [assinaturas, setAssinaturas] = useState({}) // { ordemId: { id, ...doc } }
  const [versaoAss, setVersaoAss] = useState(0) // recarrega assinaturas apos assinar
  const [coletando, setColetando] = useState(null) // { ass, papel } no modal presencial
  const { dados: materiais } = useCollection('materiais')

  // A OS guarda um retrato do material (nome/codigo da epoca). Para refletir
  // edicoes feitas no estoque, cruzamos pelo id e usamos o dado atual; se o
  // material foi excluido, cai no que estava gravado na OS.
  const materiaisMap = useMemo(() => {
    const m = {}
    materiais.forEach(mat => { m[mat.id] = mat })
    return m
  }, [materiais])

  function itemAtual(item) {
    const atual = item.id && materiaisMap[item.id]
    if (!atual) return item
    return {
      ...item,
      nome: atual.nome || item.nome,
      codigo: atual.codigo || item.codigo,
      categoria: atual.categoria || item.categoria,
    }
  }

  useEffect(() => {
    async function buscarOrdens() {
      try {
        const q = query(collection(db, 'ordens_saida'), where('eventoId', '==', evento.id))
        const snap = await getDocs(q)
        const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        dados.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
        setOrdens(dados)

        // Carrega as fotos das saidas (fotos_saida, uma por documento), agrupadas
        // por ordem. Query "in" aceita ate 10 ids por vez, entao busca em lotes.
        const ids = dados.map(d => d.id)
        const porOrdem = {}
        for (let i = 0; i < ids.length; i += 10) {
          const lote = ids.slice(i, i + 10)
          const fSnap = await getDocs(query(collection(db, 'fotos_saida'), where('ordemId', 'in', lote)))
          fSnap.docs.forEach(d => {
            const f = { id: d.id, ...d.data() }
            ;(porOrdem[f.ordemId] = porOrdem[f.ordemId] || []).push(f)
          })
        }
        Object.values(porOrdem).forEach(arr => arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)))
        setFotosPorOrdem(porOrdem)

        // Carrega as assinaturas (assinaturas_saida) de cada OS pelo token.
        const assPorOrdem = {}
        await Promise.all(dados.filter(d => d.tokenAssinatura).map(async d => {
          try {
            const aSnap = await getDoc(doc(db, 'assinaturas_saida', d.tokenAssinatura))
            if (aSnap.exists()) assPorOrdem[d.id] = { id: aSnap.id, ...aSnap.data() }
          } catch { /* ignora assinatura ausente */ }
        }))
        setAssinaturas(assPorOrdem)
      } catch (e) {
        console.error(e)
      } finally {
        setCarregando(false)
      }
    }
    buscarOrdens()
  }, [evento.id, versaoAss])

  // Materiais que estao vinculados ao evento (eventoAtual) mas NAO aparecem em
  // nenhuma OS (ex.: adicionados pelo "Editar material"). Sem isso, ficavam
  // invisiveis no detalhe e no relatorio mesmo estando "em evento".
  const idsNasOrdens = useMemo(() => {
    const s = new Set()
    ordens.forEach(o => (o.itens || []).forEach(it => it.id && s.add(it.id)))
    return s
  }, [ordens])

  const materiaisAvulsos = useMemo(
    () => materiais.filter(m => m.eventoAtual === evento.id && !idsNasOrdens.has(m.id)),
    [materiais, idsNasOrdens, evento.id]
  )

  const totalItens = ordens.reduce((acc, o) => acc + (o.itens?.length || 0), 0) + materiaisAvulsos.length
  const geradores = [...new Set(ordens.flatMap(codigosGeradoresDaOrdem))]

  function imprimir() {
    const dataEvento = evento.data ? new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

    const blocoOrdens = ordens.map(o => {
      const itensLinhas = (o.itens || []).map((itemBruto, idx) => {
        const item = itemAtual(itemBruto)
        return `<tr class="${idx % 2 === 0 ? 'row-par' : ''}">
          <td>${item.nome}${item.quantidade > 0 ? ` <strong>(${item.quantidade} un.)</strong>` : ''}</td>
          <td class="mono">${item.codigo}</td>
          <td>${item.categoria || '—'}</td>
        </tr>`
      }).join('')

      return `
        <div class="ordem">
          <div class="ordem-header">
            <span class="ordem-num">${o.numeroFormatado}</span>
            <div class="ordem-pessoas">
              <span class="pessoa"><span class="label">Entregou:</span> ${o.operadorNome || '—'}</span>
              <span class="separador">·</span>
              <span class="pessoa"><span class="label">Recebeu:</span> ${o.responsavelNome || '—'}</span>
              ${codigosGeradoresDaOrdem(o).length > 0 ? `<span class="separador">·</span><span class="pessoa"><span class="label">${codigosGeradoresDaOrdem(o).length > 1 ? 'Geradores' : 'Gerador'}:</span> ${codigosGeradoresDaOrdem(o).join(', ')}</span>` : ''}
            </div>
          </div>
          <table>
            <thead><tr><th>Material</th><th>Código</th><th>Categoria</th></tr></thead>
            <tbody>${itensLinhas}</tbody>
          </table>
          ${o.observacoes ? `<p class="obs">"${o.observacoes}"</p>` : ''}
          ${(fotosPorOrdem[o.id]?.length) ? `<div class="fotos">${fotosPorOrdem[o.id].map(f => `<img class="foto" src="${f.dataUrl}"/>`).join('')}</div>` : ''}
        </div>`
    }).join('')

    const blocoAvulsos = materiaisAvulsos.length > 0 ? `
        <div class="ordem">
          <div class="ordem-header">
            <span class="ordem-num">Materiais adicionados ao evento</span>
          </div>
          <table>
            <thead><tr><th>Material</th><th>Código</th><th>Categoria</th></tr></thead>
            <tbody>${materiaisAvulsos.map((m, idx) =>
              `<tr class="${idx % 2 === 0 ? 'row-par' : ''}">
                <td>${m.nome}</td>
                <td class="mono">${m.codigo}</td>
                <td>${m.categoria || '—'}</td>
              </tr>`
            ).join('')}</tbody>
          </table>
        </div>` : ''

    // Assinaturas digitais (entregou/recebeu) por OS. Se nenhuma OS tem registro
    // de assinatura, cai no formato antigo de linhas em branco para assinar a mao.
    const ordensComAss = ordens.filter(o => assinaturas[o.id])
    const multiplas = ordensComAss.length > 1
    const blocoAssinaturasGrid = ordensComAss.length > 0
      ? ordensComAss.map(o => {
          const a = assinaturas[o.id]
          const suf = multiplas ? ` · ${o.numeroFormatado}` : ''
          const lado = (assinatura, nome, label) => `
            <div class="assinatura-bloco">
              ${assinatura
                ? `<img class="assinatura-img" src="${assinatura}"/>`
                : '<div class="assinatura-linha"></div>'}
              <div class="assinatura-nome">${nome || ''}</div>
              <div class="assinatura-label">${label}${suf}</div>
              ${assinatura ? '' : '<div class="assinatura-pend">Pendente</div>'}
            </div>`
          return `<div class="assinaturas-grid" style="margin-bottom:28px">
            ${lado(a.entregouAssinatura, a.entregouNome, 'Entregou')}
            ${lado(a.recebeuAssinatura, a.recebeuNome, 'Recebeu')}
          </div>`
        }).join('')
      : `<div class="assinaturas-grid">
          <div class="assinatura-bloco">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">${[...new Set(ordens.map(o => o.operadorNome).filter(Boolean))].join(' / ') || ''}</div>
            <div class="assinatura-label">Almoxarife — Entregou</div>
          </div>
          <div class="assinatura-bloco">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">${[...new Set(ordens.map(o => o.responsavelNome).filter(Boolean))].join(' / ') || ''}</div>
            <div class="assinatura-label">Responsável — Recebeu</div>
          </div>
        </div>`

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
    .fotos { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-top: 1px solid #f0f0f0; }
    .foto { width: 130px; height: 130px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e5e5; }

    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
    .total { font-size: 13px; font-weight: 700; color: #1a1a1a; }

    .assinaturas { margin-top: 40px; page-break-inside: avoid; }
    .assinaturas-titulo { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 28px; }
    .assinaturas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
    .assinatura-bloco { display: flex; flex-direction: column; gap: 6px; }
    .assinatura-nome { font-size: 13px; font-weight: 700; color: #1a1a1a; min-height: 18px; }
    .assinatura-linha { border-bottom: 1.5px solid #1a1a1a; margin-top: 32px; margin-bottom: 6px; }
    .assinatura-img { height: 56px; max-width: 100%; object-fit: contain; object-position: left bottom; border-bottom: 1.5px solid #1a1a1a; margin-top: 8px; margin-bottom: 6px; }
    .assinatura-label { font-size: 11px; color: #888; }
    .assinatura-pend { font-size: 11px; color: #c08400; font-weight: 600; }
    .ressalvas { margin-top: 28px; }
    .ressalvas-label { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .ressalvas-box { border: 1px solid #e5e5e5; border-radius: 6px; min-height: 56px; padding: 10px 12px; font-size: 12px; color: #bbb; font-style: italic; }

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
      ${ehSublocacao(evento) ? `<div class="evento-info"><strong>Sublocação</strong>${evento.retiradoPor ? ` &nbsp;·&nbsp; retirado por ${evento.retiradoPor}` : ''}${evento.retiradoDocumento ? ` &nbsp;·&nbsp; doc. ${evento.retiradoDocumento}` : ''}${evento.retiradoTelefone ? ` &nbsp;·&nbsp; ${evento.retiradoTelefone}` : ''}</div>` : ''}
      ${ehLocacao(evento) ? '<div class="evento-info"><strong>Locação mensal</strong></div>' : ''}
    </div>
  </div>

  <div class="resumo">
    <div class="resumo-box"><div class="num">${ordens.length}</div><div class="desc">Saídas</div></div>
    <div class="resumo-box"><div class="num">${totalItens}</div><div class="desc">Materiais</div></div>
    <div class="resumo-box"><div class="num">${geradores.length}</div><div class="desc">Geradores</div></div>
  </div>

  ${blocoOrdens || '<p style="color:#888;text-align:center;padding:20px">Nenhuma saída registrada.</p>'}
  ${blocoAvulsos}

  <div class="assinaturas">
    <div class="assinaturas-titulo">Assinaturas</div>
    ${blocoAssinaturasGrid}
    <div class="ressalvas">
      <div class="ressalvas-label">Observações / Ressalvas</div>
      <div class="ressalvas-box">______________________________________________________________________________________________________________</div>
    </div>
  </div>

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
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-brand-red text-sm">{ordem.numeroFormatado}</span>
                      {codigosGeradoresDaOrdem(ordem).length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {codigosGeradoresDaOrdem(ordem).map(cod => (
                            <span key={cod} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{cod}</span>
                          ))}
                        </div>
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
                        {ordem.itens.map((itemBruto, i) => {
                          const item = itemAtual(itemBruto)
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                              <span className="truncate">{item.nome}</span>
                              {item.quantidade > 0 && (
                                <span className="flex-shrink-0 bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">{item.quantidade} un.</span>
                              )}
                              <span className="text-gray-400 font-mono flex-shrink-0">{item.codigo}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {ordem.observacoes && (
                      <p className="text-xs text-gray-500 italic">"{ordem.observacoes}"</p>
                    )}

                    {fotosPorOrdem[ordem.id]?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          {fotosPorOrdem[ordem.id].length} {fotosPorOrdem[ordem.id].length === 1 ? 'foto' : 'fotos'}
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {fotosPorOrdem[ordem.id].map(f => (
                            <button
                              key={f.id}
                              onClick={() => setFotoAmpliada(f.dataUrl)}
                              className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-brand-red transition-colors"
                            >
                              <img src={f.dataUrl} alt="Foto da saída" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {assinaturas[ordem.id] && (
                      <BlocoAssinaturas
                        ass={assinaturas[ordem.id]}
                        onAmpliar={setFotoAmpliada}
                        onColetar={(papel) => setColetando({ ass: assinaturas[ordem.id], papel })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {materiaisAvulsos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Materiais adicionados ao evento (sem OS)
              </p>
              <div className="border border-gray-100 rounded-xl p-3">
                <div className="space-y-1">
                  {materiaisAvulsos.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <span className="truncate">{m.nome}</span>
                      <span className="text-gray-400 font-mono flex-shrink-0">{m.codigo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3 flex-wrap">
          <button onClick={onFechar} className="btn-secondary flex-1">Fechar</button>
          {ehSublocacao(evento) && (
            <button
              onClick={() => gerarDeclaracaoSublocacao(
                evento,
                ordens,
                assinaturas[ordens[0]?.id] || null,
                itemAtual,
              )}
              className="btn-secondary flex-1 justify-center gap-2 border-teal-300 text-teal-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Declaração
            </button>
          )}
          <button onClick={imprimir} className="btn-primary flex-1 justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Gerar Relatório
          </button>
        </div>
      </div>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <img src={fotoAmpliada} alt="Foto da saída" className="max-w-full max-h-full rounded-lg object-contain" />
          <button
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {coletando && (
        <ModalColetarAssinatura
          ass={coletando.ass}
          papel={coletando.papel}
          onFechar={() => setColetando(null)}
          onAssinado={() => { setColetando(null); setVersaoAss(v => v + 1) }}
        />
      )}
    </div>
  )
}

// Mostra o status das assinaturas de uma OS e as acoes (link / presencial).
function BlocoAssinaturas({ ass, onAmpliar, onColetar }) {
  const link = `${window.location.origin}/assinar/${ass.id}`
  const [copiado, setCopiado] = useState(false)
  const msg = `Confirme o recebimento do material da SOS Energia assinando aqui: ${link}`

  function linha(papel, nome, assinatura) {
    return (
      <div className="flex items-center gap-2">
        {assinatura ? (
          <button onClick={() => onAmpliar(assinatura)} className="w-12 h-8 rounded border border-gray-200 bg-white overflow-hidden flex-shrink-0">
            <img src={assinatura} alt="Assinatura" className="w-full h-full object-contain" />
          </button>
        ) : (
          <span className="w-12 h-8 rounded border border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-400">{papel}</p>
          <p className="text-xs font-semibold text-brand-black truncate">{nome || '—'}</p>
        </div>
        {assinatura
          ? <span className="ml-auto text-xs font-semibold text-green-600 flex-shrink-0">assinado</span>
          : <button onClick={() => onColetar(papel === 'Entregou' ? 'entregou' : 'recebeu')} className="ml-auto text-xs font-semibold text-brand-red flex-shrink-0">assinar</button>
        }
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-2 space-y-2">
      {linha('Entregou', ass.entregouNome, ass.entregouAssinatura)}
      {linha('Recebeu', ass.recebeuNome, ass.recebeuAssinatura)}
      {!ass.recebeuAssinatura && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() => { navigator.clipboard?.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}
            className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:border-brand-red hover:text-brand-red transition-colors"
          >
            {copiado ? 'Link copiado!' : 'Copiar link'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-green-700 border border-green-200 rounded-lg px-2.5 py-1 hover:bg-green-50 transition-colors"
          >
            WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

// Coleta presencial de uma assinatura pendente (entregou/recebeu), gravando no
// proprio documento assinaturas_saida.
function ModalColetarAssinatura({ ass, papel, onFechar, onAssinado }) {
  const ehRecebeu = papel === 'recebeu'
  const [nome, setNome] = useState(ehRecebeu ? (ass.recebeuNome || '') : (ass.entregouNome || ''))
  const [assinatura, setAssinatura] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    if (!assinatura) { setErro('Assine no campo acima.'); return }
    setSalvando(true); setErro('')
    try {
      const campos = ehRecebeu
        ? { recebeuNome: nome.trim(), recebeuAssinatura: assinatura, status: 'assinada', assinadoEm: serverTimestamp() }
        : { entregouNome: nome.trim(), entregouAssinatura: assinatura }
      await updateDoc(doc(db, 'assinaturas_saida', ass.id), campos)
      if (ehRecebeu) {
        try { await updateDoc(doc(db, 'ordens_saida', ass.ordemId), { assinaturaStatus: 'assinada' }) } catch { /* ok */ }
      }
      onAssinado()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar. Tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-brand-black">Assinatura — {ehRecebeu ? 'quem recebeu' : 'quem entregou'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{ass.numeroFormatado}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="input" />
          </div>
          <SignaturePad titulo="Assinatura *" valor={assinatura} onChange={setAssinatura} />
          {erro && <p className="text-sm text-brand-red">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar assinatura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Status que o gerador assume conforme a modalidade do evento a que está preso.
const STATUS_GG_POR_TIPO = { evento: 'em_evento', locacao_mensal: 'locacao', sublocacao: 'sublocado' }

const TIPOS_EVENTO = [
  { valor: 'evento', label: 'Evento' },
  { valor: 'locacao_mensal', label: 'Locação mensal' },
  { valor: 'sublocacao', label: 'Sublocação' },
]

function ModalFormEvento({ evento, onFechar, onSalvar }) {
  const [form, setForm] = useState({
    nome: evento?.nome || '',
    local: evento?.local || '',
    data: evento?.data || '',
    status: evento?.status || 'ativo',
    // documento sem `tipo` é evento — mesma convenção do resto do sistema
    tipo: evento?.tipo || 'evento',
    previsaoDevolucao: evento?.previsaoDevolucao || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const tipoOriginal = evento?.tipo || 'evento'
  const mudouTipo = !!evento && form.tipo !== tipoOriginal
  const ehEvento = form.tipo === 'evento'

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    setSalvando(true)
    setErro('')
    try {
      const campos = {
        nome: form.nome.trim(),
        local: form.local.trim(),
        data: form.data,
        status: form.status,
        // 'evento' é representado pela AUSÊNCIA do campo: gravar null mantém a
        // convenção e ainda desfaz uma conversão anterior.
        tipo: ehEvento ? null : form.tipo,
        // só evento tem previsão de devolução; locação fica com o cliente
        previsaoDevolucao: ehEvento ? (form.previsaoDevolucao || null) : null,
      }

      if (evento) {
        await updateDoc(doc(db, 'eventos', evento.id), campos)

        // Converter a modalidade tem que mover junto os geradores presos a ela,
        // senão a frota continua mostrando "Em Evento" para uma locação.
        if (mudouTipo) {
          const ggs = await getDocs(query(collection(db, 'geradores'), where('eventoAtual', '==', evento.id)))
          if (!ggs.empty) {
            const lote = writeBatch(db)
            ggs.forEach(d => lote.update(d.ref, { status: STATUS_GG_POR_TIPO[form.tipo] }))
            await lote.commit()
          }
        }
      } else {
        await addDoc(collection(db, 'eventos'), { ...campos, criadoEm: serverTimestamp() })
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidade</label>
            <select className="input w-full" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS_EVENTO.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
            {mudouTipo && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                Os geradores deste evento passarão para o status{' '}
                <strong>{statusGeradorLabel(STATUS_GG_POR_TIPO[form.tipo])}</strong>.
                O material continua vinculado e volta pela Devolução, como sempre.
              </p>
            )}
          </div>

          {ehEvento && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de devolução</label>
              <DatePicker
                value={form.previsaoDevolucao}
                onChange={v => setForm(p => ({ ...p, previsaoDevolucao: v }))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Passando dessa data sem devolução, o material aparece no painel para ser cobrado.
                Em branco, não gera cobrança.
              </p>
            </div>
          )}

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
      geradoresSnap.forEach(d => batch.update(d.ref, { status: 'disponivel', eventoAtual: null, eventoNome: null, localizacao: 'Pátio SOS' }))

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
            <h2 className="font-bold text-brand-black">{ehSublocacao(evento) ? 'Encerrar sublocação' : ehLocacao(evento) ? 'Encerrar locação' : 'Concluir evento'}</h2>
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
              <p className="text-sm">Nenhum material vinculado a {ehSublocacao(evento) ? 'esta sublocação' : ehLocacao(evento) ? 'esta locação' : 'este evento'}.</p>
              <p className="text-xs mt-1">{ehSublocacao(evento) ? 'A sublocação será encerrada.' : ehLocacao(evento) ? 'A locação será encerrada.' : 'O evento será marcado como concluído.'}</p>
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

  const categoriasFiltro = useMemo(() => {
    const extras = [...new Set(todosMateriais.map(m => m.categoria).filter(Boolean))]
      .filter(c => !CATEGORIAS_MAT.includes(c))
      .sort((a, b) => a.localeCompare(b))
    return [...CATEGORIAS_MAT, ...extras]
  }, [todosMateriais])

  const materiaisDoEvento = todosMateriais.filter(m => m.eventoAtual === evento.id)
  const disponiveisFiltrados = todosMateriais.filter(m => {
    if (m.status !== 'disponivel') return false
    if (categoria !== 'Todos' && m.categoria !== categoria) return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q)
  })

  // Ao retirar um material que saiu numa OS, ele tambem precisa sumir do retrato
  // congelado da OS (usado no relatorio do evento) e do doc de assinatura (usado no
  // link enviado ao colaborador em campo). Sem isso, o item voltava ao estoque mas
  // continuava aparecendo no relatorio e no link.
  async function propagarRemocaoNoRelatorio(material) {
    const q = query(collection(db, 'ordens_saida'), where('eventoId', '==', evento.id))
    const snap = await getDocs(q)
    for (const d of snap.docs) {
      const dados = d.data()
      const itens = dados.itens || []
      if (!itens.some(it => it.id === material.id)) continue
      await updateDoc(d.ref, { itens: itens.filter(it => it.id !== material.id) })
      // Os itens da assinatura nao guardam id: casam pelo codigo do material.
      if (dados.tokenAssinatura) {
        try {
          const assRef = doc(db, 'assinaturas_saida', dados.tokenAssinatura)
          const assSnap = await getDoc(assRef)
          if (assSnap.exists()) {
            const assItens = (assSnap.data().itens || []).filter(it => it.codigo !== material.codigo)
            await updateDoc(assRef, { itens: assItens })
          }
        } catch (e) { console.error(e) }
      }
    }
  }

  async function remover(material) {
    setProcessando(material.id)
    try {
      await updateDoc(doc(db, 'materiais', material.id), { status: 'disponivel', estoqueAtual: 1, eventoAtual: null })
      await propagarRemocaoNoRelatorio(material)
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
                  <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-black truncate">{m.nome}</p>
                      <p className="text-xs text-gray-500 font-mono">{m.codigo}</p>
                    </div>
                    <button
                      onClick={() => remover(m)}
                      disabled={processando === m.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold border border-red-200 text-brand-red rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
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
              {categoriasFiltro.map(cat => (
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
                  <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-black truncate">{m.nome}</p>
                      <p className="text-xs text-gray-500 font-mono">{m.codigo}</p>
                    </div>
                    <button
                      onClick={() => adicionar(m)}
                      disabled={processando === m.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40"
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

function ModalEditarGeradorEvento({ evento, onFechar }) {
  const { dados: todosGeradores, carregando } = useCollection('geradores')
  const [busca, setBusca] = useState('')
  const [processando, setProcessando] = useState(null)

  const geradoresDoEvento = todosGeradores.filter(g => g.eventoAtual === evento.id)
  const disponiveisFiltrados = todosGeradores.filter(g => {
    if (g.status !== 'disponivel') return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return (g.codigo || '').toLowerCase().includes(q) ||
      (g.modelo || '').toLowerCase().includes(q) ||
      (g.marca || '').toLowerCase().includes(q) ||
      (g.potencia || '').toLowerCase().includes(q)
  })

  const localEvento = `${evento.nome}${evento.local ? ' · ' + evento.local : ''}`

  async function remover(gerador) {
    setProcessando(gerador.id)
    try {
      await updateDoc(doc(db, 'geradores', gerador.id), {
        status: 'disponivel', eventoAtual: null, eventoNome: null, localizacao: 'Pátio SOS',
      })
    } catch (e) { console.error(e) }
    finally { setProcessando(null) }
  }

  async function adicionar(gerador) {
    setProcessando(gerador.id)
    try {
      await updateDoc(doc(db, 'geradores', gerador.id), {
        status: 'em_evento', eventoAtual: evento.id, eventoNome: evento.nome, localizacao: localEvento,
      })
    } catch (e) { console.error(e) }
    finally { setProcessando(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-brand-black">Editar geradores</h2>
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
              No evento ({geradoresDoEvento.length})
            </p>
            {carregando ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : geradoresDoEvento.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Nenhum gerador vinculado a este evento.</p>
            ) : (
              <div className="space-y-2">
                {geradoresDoEvento.map(g => (
                  <div key={g.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-black truncate">{g.codigo}</p>
                      <p className="text-xs text-gray-500 truncate">{[g.potencia, g.marca, g.modelo].filter(Boolean).join(' • ')}</p>
                    </div>
                    <button
                      onClick={() => remover(g)}
                      disabled={processando === g.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold border border-red-200 text-brand-red rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {processando === g.id ? '...' : 'Retirar'}
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
              placeholder="Buscar por código, potência ou modelo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input w-full mb-2"
            />
            {carregando ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : disponiveisFiltrados.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{busca ? 'Nenhum resultado para a busca.' : 'Nenhum gerador disponível.'}</p>
            ) : (
              <div className="space-y-2">
                {disponiveisFiltrados.map(g => (
                  <div key={g.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-black truncate">{g.codigo}</p>
                      <p className="text-xs text-gray-500 truncate">{[g.potencia, g.marca, g.modelo].filter(Boolean).join(' • ')}</p>
                    </div>
                    <button
                      onClick={() => adicionar(g)}
                      disabled={processando === g.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40"
                    >
                      {processando === g.id ? '...' : 'Adicionar'}
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
