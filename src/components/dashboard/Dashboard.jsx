import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { formatarData, statusEventoCor, statusEventoLabel } from '../../utils/formatters'
import { PERFIS } from '../../utils/permissions'
import { seedFiltrosReais, seedMateriaisReais } from '../../firebase/seed'

function CardResumo({ titulo, valor, cor, icone, to }) {
  const conteudo = (
    <div className={`card flex items-center gap-4 ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cor}`}>
        {icone}
      </div>
      <div>
        <p className="text-2xl font-bold text-brand-black">{valor}</p>
        <p className="text-sm text-gray-500">{titulo}</p>
      </div>
    </div>
  )
  return to ? <Link to={to}>{conteudo}</Link> : conteudo
}

export default function Dashboard() {
  const { nome, tipoPerfil } = useAuth()
  const [importando, setImportando] = useState(null)
  const [importOk, setImportOk] = useState({ filtros: false, materiais: false })

  async function importarFiltros() {
    if (!window.confirm('Importar 181 filtros reais da planilha para o Firestore?')) return
    setImportando('filtros')
    try {
      const total = await seedFiltrosReais()
      setImportOk(prev => ({ ...prev, filtros: true }))
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
      setImportOk(prev => ({ ...prev, materiais: true }))
      window.alert(`✅ ${total} itens importados com sucesso!`)
    } catch (e) {
      window.alert('Erro ao importar: ' + e.message)
    } finally {
      setImportando(null)
    }
  }
  const { dados: eventos, carregando: carregandoEvt } = useCollection('eventos')
  const { dados: materiais, carregando: carregandoMat } = useCollection('materiais')
  const { dados: ordensAberto } = useCollection('devolucoes')

  const stats = useMemo(() => {
    const hoje = new Date()
    const inicioSemana = new Date(hoje)
    inicioSemana.setDate(hoje.getDate() - hoje.getDay())
    const fimSemana = new Date(inicioSemana)
    fimSemana.setDate(inicioSemana.getDate() + 6)

    const eventosAtivos = eventos.filter(e => e.status === 'ativo').length
    const itensEmCampo = materiais.filter(m => m.status === 'em_evento').length
    const estoquesBaixo = materiais.filter(m => m.estoqueAtual <= m.estoqueMin && m.estoqueMin > 0).length
    const eventosRecentes = eventos
      .filter(e => ['ativo', 'agendado'].includes(e.status))
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .slice(0, 6)

    return { eventosAtivos, itensEmCampo, estoquesBaixo, eventosRecentes }
  }, [eventos, materiais])

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardResumo
          titulo="Eventos Ativos"
          valor={stats.eventosAtivos}
          cor="bg-blue-100 text-blue-600"
          to="/saida"
          icone={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <CardResumo
          titulo="Itens em Campo"
          valor={stats.itensEmCampo}
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

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brand-black">Próximos Eventos</h2>
          <Link to="/saida" className="text-brand-red text-sm font-medium hover:underline">
            Ver todos →
          </Link>
        </div>

        {stats.eventosRecentes.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhum evento ativo ou agendado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Evento</th>
                  <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Local</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Data</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.eventosRecentes.map(evt => (
                  <tr key={evt.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 font-medium text-brand-black">{evt.nome}</td>
                    <td className="py-2.5 text-gray-500 hidden sm:table-cell">{evt.local}</td>
                    <td className="py-2.5 text-gray-600">{formatarData(evt.data)}</td>
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
      {tipoPerfil === PERFIS.ADMIN && (!importOk.filtros || !importOk.materiais) && (
        <div className="space-y-2">
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
