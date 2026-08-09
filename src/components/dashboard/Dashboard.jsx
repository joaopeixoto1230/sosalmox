import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { statusEventoCor, statusEventoLabel } from '../../utils/formatters'
import { PERFIS, MODULOS, temPermissao } from '../../utils/permissions'
import { GRUPOS, grupoDoMaterial } from '../estoque/categorias'
import { calcularEspecies, contarEstoqueBaixo } from '../estoque/estoqueEspecie'
import { calcularPendencias, previsaoDoEvento, diasDeAtraso, hojeISO } from './pendencias'
import Rosca from './Rosca'
import { CORES } from './cores'
import { seedFiltrosReais, seedMateriaisReais, fixCategoriasReais, seedGeradoresReais, fixGeradoresReais } from '../../firebase/seed'

function CardResumo({ titulo, valor, cor, icone, to, detalhe }) {
  const conteudo = (
    <div className={`card flex items-center gap-4 ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cor}`}>
        {icone}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-brand-black">{valor}</p>
        <p className="text-sm text-gray-500">{titulo}</p>
        {detalhe && <p className="text-xs text-gray-400 mt-0.5 truncate">{detalhe}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{conteudo}</Link> : conteudo
}

// Documento de `eventos` sem o campo `tipo` conta como evento (mesma convenção
// da aba Eventos e da Saída de Material) — sem migração de dados.
const TIPO_LOCACAO = 'locacao_mensal'
const TIPO_SUBLOCACAO = 'sublocacao'
const ehEventoPuro = e => !e.tipo

const SELO_TIPO = {
  [TIPO_LOCACAO]: { label: 'Locação', cor: 'bg-purple-100 text-purple-700' },
  [TIPO_SUBLOCACAO]: { label: 'Sublocação', cor: 'bg-teal-100 text-teal-700' },
}

// Situação da frota agrupada pela pergunta que interessa: dá para fechar
// negócio hoje? O detalhe por status continua na legenda.
const GRUPOS_FROTA = [
  { chave: 'prontos', label: 'Prontos para sair', cor: 'bg-green-500', texto: 'text-green-600', estados: ['disponivel'] },
  { chave: 'emuso', label: 'Em uso com cliente', cor: 'bg-blue-500', texto: 'text-blue-600', estados: ['em_evento', 'locacao', 'sublocado'] },
  { chave: 'indisp', label: 'Indisponíveis', cor: 'bg-orange-500', texto: 'text-orange-600', estados: ['manutencao', 'defeito'] },
]

function FaixaPendencias({ itens }) {
  if (!itens.length) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900/50">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500">Precisa de atenção</p>
        <span className="ml-auto text-xs text-amber-700/80 dark:text-amber-500/80">
          {itens.length} {itens.length === 1 ? 'pendência' : 'pendências'}
        </span>
      </div>
      {itens.map(p => (
        <Link
          key={p.chave}
          to={p.para}
          className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-amber-100 dark:border-amber-900/30 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors"
        >
          <span className={`min-w-[30px] h-6 px-1.5 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            p.nivel === 'critico' ? 'bg-red-100 text-brand-red' : 'bg-amber-100 text-amber-700'
          }`}>
            {p.n}
          </span>
          <span className="text-sm text-brand-black flex-1 min-w-0">
            {p.texto}
            {p.detalhe && <span className="text-gray-500"> — {p.detalhe}</span>}
          </span>
          <span className="text-xs font-medium text-brand-red flex-shrink-0 hidden sm:inline">{p.acao} →</span>
        </Link>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { nome, tipoPerfil } = useAuth()
  // Congela o "agora" na abertura da tela: ler o relógio durante o render torna
  // o componente impuro e o resultado instável entre re-renders.
  const [abertoEm] = useState(() => Date.now())
  const [importando, setImportando] = useState(null)
  const [importForced, setImportForced] = useState({ filtros: false, materiais: false, fix: false, geradores: false, fixGeradores: false })

  const { dados: eventos, carregando: carregandoEvt } = useCollection('eventos')
  const { dados: materiais, carregando: carregandoMat } = useCollection('materiais')
  const { dados: filtros } = useCollection('filtros')
  const { dados: geradores } = useCollection('geradores')
  const { dados: ordensSaida } = useCollection('ordens_saida')
  const { dados: ordensServico } = useCollection('ordens_servico')
  const { dados: solicitacoes } = useCollection('solicitacoes_compra')

  const importOk = {
    filtros: importForced.filtros || filtros.length >= 100,
    materiais: importForced.materiais || materiais.filter(m => m.categoria !== 'gerador').length >= 150,
    fix: importForced.fix || true,
    geradores: importForced.geradores || geradores.length >= 80,
    fixGeradores: importForced.fixGeradores || geradores.length >= 80,
  }

  async function importarFiltros() {
    if (!window.confirm('Importar 181 filtros reais da planilha para o Firestore?')) return
    setImportando('filtros')
    try {
      const total = await seedFiltrosReais()
      setImportForced(prev => ({ ...prev, filtros: true }))
      window.alert(`✅ ${total} filtros importados com sucesso!`)
    } catch (e) {
      window.alert('Erro ao importar: ' + e.message)
    } finally {
      setImportando(null)
    }
  }

  async function importarMateriais() {
    if (!window.confirm('Importar 197 cabos e caixas da planilha para o Firestore?')) return
    setImportando('materiais')
    try {
      const total = await seedMateriaisReais()
      setImportForced(prev => ({ ...prev, materiais: true }))
      window.alert(`✅ ${total} itens importados com sucesso!`)
    } catch (e) {
      window.alert('Erro ao importar: ' + e.message)
    } finally {
      setImportando(null)
    }
  }

  const stats = useMemo(() => {
    const ativos = eventos.filter(e => e.status === 'ativo')
    const eventosAtivos = ativos.filter(ehEventoPuro).length
    const locacoesAtivas = ativos.filter(e => e.tipo === TIPO_LOCACAO).length
    const sublocacoesAtivas = ativos.filter(e => e.tipo === TIPO_SUBLOCACAO).length

    // Material em campo sai como 'em_evento' nas TRÊS modalidades (a devolução
    // depende desse status). A separação aqui é pelo tipo do evento-pai.
    const tipoPorEvento = new Map(eventos.map(e => [e.id, e.tipo || null]))
    const emCampo = materiais.filter(m => m.status === 'em_evento')
    const itensEmCampo = emCampo.length
    const itensEmLocacao = emCampo.filter(m => tipoPorEvento.get(m.eventoAtual) === TIPO_LOCACAO).length
    const itensSublocados = emCampo.filter(m => tipoPorEvento.get(m.eventoAtual) === TIPO_SUBLOCACAO).length
    const itensEmEvento = itensEmCampo - itensEmLocacao - itensSublocados

    // Estoque baixo usa a MESMA regra da aba Estoque (por espécie/bitola, em
    // estoque/estoqueEspecie.js). A regra antiga estoqueAtual <= estoqueMin
    // marcava todo cabo parado no pátio como baixo, porque cada cabo é um doc
    // de uma unidade (1 <= 1). Conta grupo a grupo e soma, para bater com o
    // total das duas abas do Estoque.
    const estoquesBaixo = GRUPOS.reduce((soma, g) => {
      const doGrupo = materiais.filter(m => grupoDoMaterial(m) === g.value)
      return soma + contarEstoqueBaixo(doGrupo, calcularEspecies(doGrupo))
    }, 0)

    // Agenda separada: o que passou da devolução (e prende material) vem antes
    // do que ainda vai acontecer.
    const hoje = hojeISO()
    const emAberto = eventos.filter(e => ['ativo', 'agendado'].includes(e.status))
    const comAtraso = emAberto.map(e => ({
      evento: e,
      // locação e sublocação não têm devolução prevista: nunca entram como vencidas
      atraso: ehEventoPuro(e) ? diasDeAtraso(previsaoDoEvento(e), hoje) : null,
    }))
    const vencidos = comAtraso.filter(x => x.atraso > 0).sort((a, b) => b.atraso - a.atraso)
    const proximos = comAtraso.filter(x => !(x.atraso > 0))
      .sort((a, b) => new Date(a.evento.data) - new Date(b.evento.data))
    const agenda = [...vencidos.slice(0, 4), ...proximos.slice(0, 4)]

    const eventosVencidos = vencidos.length

    return {
      eventosAtivos, locacoesAtivas, sublocacoesAtivas, eventosVencidos,
      itensEmCampo, itensEmEvento, itensEmLocacao, itensSublocados,
      estoquesBaixo, agenda, temVencido: vencidos.length > 0, hoje,
    }
  }, [eventos, materiais])

  const frota = useMemo(() => {
    const ativos = geradores.filter(g => g.ativo !== false && g.status !== 'inativo')
    const contagem = GRUPOS_FROTA.map(g => ({
      ...g, n: ativos.filter(x => g.estados.includes(x.status)).length,
    }))
    return { total: ativos.length, contagem }
  }, [geradores])

  // Composição dos últimos 90 dias, para as roscas.
  const composicao = useMemo(() => {
    const corte = abertoEm - 90 * 86400000
    const dentro = doc => {
      const d = doc.criadoEm?.toDate ? doc.criadoEm.toDate()
        : doc.dataAbertura?.toDate ? doc.dataAbertura.toDate() : null
      return d ? d.getTime() >= corte : false
    }

    const saidas = ordensSaida.filter(dentro)
    const porTipo = [
      { rotulo: 'Evento', valor: saidas.filter(o => !o.tipo).length, cor: CORES.evento },
      { rotulo: 'Locação mensal', valor: saidas.filter(o => o.tipo === TIPO_LOCACAO).length, cor: CORES.locacao },
      { rotulo: 'Sublocação', valor: saidas.filter(o => o.tipo === TIPO_SUBLOCACAO).length, cor: CORES.sublocacao },
      { rotulo: 'Uso interno', valor: saidas.filter(o => o.tipo === 'uso_interno').length, cor: CORES.usoInterno },
    ]

    const os = ordensServico.filter(dentro)
    const porManutencao = [
      { rotulo: 'Preventiva', valor: os.filter(o => o.tipo === 'preventiva').length, cor: CORES.emUso },
      { rotulo: 'Corretiva', valor: os.filter(o => o.tipo === 'corretiva').length, cor: CORES.indisponivel },
    ]

    const frotaRosca = [
      { rotulo: 'Prontos para sair', chave: 'prontos', cor: CORES.prontos },
      { rotulo: 'Em uso com cliente', chave: 'emuso', cor: CORES.emUso },
      { rotulo: 'Indisponíveis', chave: 'indisp', cor: CORES.indisponivel },
    ].map(r => ({ ...r, valor: frota.contagem.find(g => g.chave === r.chave)?.n || 0 }))

    return { porTipo, porManutencao, frotaRosca }
  }, [ordensSaida, ordensServico, frota, abertoEm])

  const pendencias = useMemo(() => calcularPendencias(
    { eventos, ordensSaida, ordensServico, solicitacoes },
    { podeVer: modulo => temPermissao(tipoPerfil, modulo) },
  ), [eventos, ordensSaida, ordensServico, solicitacoes, tipoPerfil])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = nome?.split(' ')[0] || 'usuário'

  if (carregandoEvt || carregandoMat) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  const temPendente = tipoPerfil === PERFIS.ADMIN && (!importOk.filtros || !importOk.materiais || !importOk.geradores || !importOk.fixGeradores)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">
          {saudacao}, {primeiroNome}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <FaixaPendencias itens={pendencias} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo
          titulo="Eventos Ativos"
          valor={stats.eventosAtivos}
          detalhe={stats.eventosVencidos > 0
            ? `${stats.eventosVencidos} com devolução vencida`
            : 'nenhum com devolução vencida'}
          cor="bg-blue-100 text-blue-600"
          to="/eventos"
          icone={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <CardResumo
          titulo="Locações Ativas"
          valor={stats.locacoesAtivas + stats.sublocacoesAtivas}
          detalhe={`${stats.locacoesAtivas} mensais · ${stats.sublocacoesAtivas} ${stats.sublocacoesAtivas === 1 ? 'sublocação' : 'sublocações'}`}
          cor="bg-purple-100 text-purple-600"
          to="/eventos"
          icone={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <CardResumo
          titulo="Itens em Campo"
          valor={stats.itensEmCampo}
          detalhe={`${stats.itensEmEvento} em evento · ${stats.itensEmLocacao + stats.itensSublocados} em locação`}
          cor="bg-yellow-100 text-yellow-600"
          to="/estoque"
          icone={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          }
        />
        <CardResumo
          titulo="Estoque Baixo"
          valor={stats.estoquesBaixo}
          cor={stats.estoquesBaixo > 0 ? 'bg-red-100 text-brand-red' : 'bg-green-100 text-green-600'}
          to="/estoque"
          icone={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Rosca
          titulo="Saídas por tipo"
          subtitulo="últimos 90 dias"
          unidade="saídas"
          dados={composicao.porTipo}
          recado="Mostra o peso de cada modalidade na operação."
        />
        {temPermissao(tipoPerfil, MODULOS.GERADORES) && (
          <Rosca
            titulo="Frota"
            subtitulo="situação agora"
            unidade="geradores"
            dados={composicao.frotaRosca}
            recado="Prontos para sair é quanto dá para fechar de negócio hoje."
          />
        )}
        {temPermissao(tipoPerfil, MODULOS.MANUTENCAO) && (
          <Rosca
            titulo="Manutenção"
            subtitulo="OS dos últimos 90 dias"
            unidade="OS"
            dados={composicao.porManutencao}
            recado="Corretiva crescendo é sinal de preventiva deixando passar — e corretiva custa mais."
          />
        )}
      </div>

      {temPermissao(tipoPerfil, MODULOS.GERADORES) && frota.total > 0 && (
        <div className="card">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-semibold text-brand-black">Frota de geradores</h2>
            <Link to="/geradores" className="text-brand-red text-sm font-medium hover:underline">
              {frota.total} ativos →
            </Link>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 gap-0.5">
            {frota.contagem.filter(g => g.n > 0).map(g => (
              <div key={g.chave} className={g.cor} style={{ width: `${(g.n / frota.total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {frota.contagem.map(g => (
              <span key={g.chave} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-sm ${g.cor}`} />
                {g.label}
                <b className={`font-bold ${g.texto}`}>{g.n}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brand-black">Agenda</h2>
          <Link to="/eventos" className="text-brand-red text-sm font-medium hover:underline">
            Ver todos →
          </Link>
        </div>

        {stats.agenda.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhum evento ativo ou agendado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Evento</th>
                  <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Local</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Devolução</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.agenda.map(({ evento: evt, atraso }) => (
                  <tr key={evt.id} className={`border-b border-gray-50 transition-colors ${
                    atraso > 0
                      ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60'
                      : 'hover:bg-gray-50'
                  }`}>
                    <td className="py-2.5 font-medium text-brand-black">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {evt.nome}
                        {SELO_TIPO[evt.tipo] && (
                          <span className={`badge ${SELO_TIPO[evt.tipo].cor}`}>{SELO_TIPO[evt.tipo].label}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500 hidden sm:table-cell">{evt.local}</td>
                    <td className={`py-2.5 ${atraso > 0 ? 'text-brand-red font-semibold' : 'text-gray-600'}`}>
                      {atraso > 0
                        ? `venceu há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`
                        : SELO_TIPO[evt.tipo]
                          ? 'em aberto'
                          : (previsaoDoEvento(evt)
                            ? new Date(previsaoDoEvento(evt) + 'T00:00:00').toLocaleDateString('pt-BR')
                            : <span className="text-gray-400">não informada</span>)}
                    </td>
                    <td className="py-2.5">
                      <span className={`badge ${statusEventoCor(evt.status)}`}>
                        {statusEventoLabel(evt.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {[PERFIS.ADMIN, PERFIS.ALMOXARIFE, PERFIS.GERENTE].includes(tipoPerfil) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nova Saída', path: '/saida', cor: 'bg-brand-red text-white hover:bg-brand-red-dark' },
            { label: 'Devolução', path: '/devolucao', cor: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50' },
            { label: 'Transferência', path: '/transferencia', cor: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50' },
            { label: 'Estoque', path: '/estoque', cor: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50' },
          ].map(a => (
            <Link
              key={a.path}
              to={a.path}
              className={`${a.cor} rounded-xl p-4 text-center text-sm font-semibold transition-colors`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}

      {temPendente && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">Configuração inicial de dados</p>
          {!importOk.fixGeradores && (
            <div className="card border-l-4 border-orange-500 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-black text-sm">Remover geradores fora da planilha</p>
                <p className="text-xs text-gray-500 mt-0.5">Exclui GGs que não constam na Potência_dos_geradores_SOS_2024</p>
              </div>
              <button onClick={async () => {
                if (!window.confirm('Remover do Firestore todos os geradores que não estão na planilha 2024?')) return
                setImportando('fixGeradores')
                try {
                  const n = await fixGeradoresReais()
                  setImportForced(prev => ({ ...prev, fixGeradores: true }))
                  window.alert(`✅ ${n} geradores removidos!`)
                } catch(e) { window.alert('Erro: ' + e.message) }
                finally { setImportando(null) }
              }} disabled={importando !== null}
                className="btn-primary text-sm px-4 py-2 flex-shrink-0 disabled:opacity-50">
                {importando === 'fixGeradores' ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          )}
          {!importOk.geradores && (
            <div className="card border-l-4 border-green-500 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-black text-sm">Importar geradores da planilha</p>
                <p className="text-xs text-gray-500 mt-0.5">83 GGs reais — Potência_dos_geradores_SOS_2024.xlsx</p>
              </div>
              <button onClick={async () => {
                if (!window.confirm('Importar 83 geradores reais para o Firestore?')) return
                setImportando('geradores')
                try {
                  const total = await seedGeradoresReais()
                  setImportForced(prev => ({ ...prev, geradores: true }))
                  window.alert(`✅ ${total} geradores importados com sucesso!`)
                } catch(e) { window.alert('Erro: ' + e.message) }
                finally { setImportando(null) }
              }} disabled={importando !== null}
                className="btn-primary text-sm px-4 py-2 flex-shrink-0 disabled:opacity-50">
                {importando === 'geradores' ? 'Importando...' : 'Importar'}
              </button>
            </div>
          )}
          {!importOk.filtros && (
            <div className="card border-l-4 border-brand-red p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-black text-sm">Importar filtros reais da planilha</p>
                <p className="text-xs text-gray-500 mt-0.5">181 filtros de 50 GGs — Geradores_SOS_2021.xlsx</p>
              </div>
              <button onClick={importarFiltros} disabled={importando !== null}
                className="btn-primary text-sm px-4 py-2 flex-shrink-0 disabled:opacity-50">
                {importando === 'filtros' ? 'Importando...' : 'Importar'}
              </button>
            </div>
          )}
          {!importOk.materiais && (
            <div className="card border-l-4 border-yellow-500 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-black text-sm">Importar cabos e caixas da planilha</p>
                <p className="text-xs text-gray-500 mt-0.5">197 itens — Cabos_descontrados.xlsx</p>
              </div>
              <button onClick={importarMateriais} disabled={importando !== null}
                className="btn-primary text-sm px-4 py-2 flex-shrink-0 disabled:opacity-50">
                {importando === 'materiais' ? 'Importando...' : 'Importar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
