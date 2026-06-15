import { useState, useMemo } from 'react'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, MODULOS, PERFIS } from '../../utils/permissions'
import FiltroCard from './FiltroCard'
import EntradaFiltroModal from './EntradaFiltroModal'
import BaixaFiltroModal from './BaixaFiltroModal'
import NovoFiltroModal from './NovoFiltroModal'
import SaidaFiltrosModal from './SaidaFiltrosModal'
import FiltrosIguaisModal from './FiltrosIguaisModal'

const STATUS_OPCOES = ['Todos', 'OK', 'Baixo', 'Crítico']
const POTENCIAS_VEICULO = ['Caminhão', 'Empilhadeira']
const ABAS = [
  { id: 'geradores', label: 'Geradores' },
  { id: 'caminhoes', label: 'Caminhões' },
  { id: 'empilhadeira', label: 'Empilhadeira' },
]

function filtroDaAba(f, aba) {
  if (aba === 'caminhoes') return f.potenciaGG === 'Caminhão'
  if (aba === 'empilhadeira') return f.potenciaGG === 'Empilhadeira'
  return !POTENCIAS_VEICULO.includes(f.potenciaGG)
}

const FILTROS_700KVA = [
  { id: 'flt_700_FS19735',   tipo: 'Filtro Separador de Água', nome: 'FS19735 Fleetguard',              referencia: 'FS19735', fornecedor: 'Fleetguard'  },
  { id: 'flt_700_RC358',     tipo: 'Filtro de Combustível 1',  nome: 'Filtro de Combustível RC358',      referencia: 'RC358',   fornecedor: 'Fleetguard'  },
  { id: 'flt_700_AF26429',   tipo: 'Filtro de Ar',             nome: 'AF26429 Fleetguard',               referencia: 'AF26429', fornecedor: 'Fleetguard'  },
  { id: 'flt_700_FF5507',    tipo: 'Filtro de Combustível 2',  nome: 'FF5507 Fleetguard',                referencia: 'FF5507',  fornecedor: 'Fleetguard'  },
  { id: 'flt_700_LF3675',    tipo: 'Filtro de Óleo 1',         nome: 'LF3675 Fleetguard',                referencia: 'LF3675',  fornecedor: 'Fleetguard'  },
  { id: 'flt_700_W11102',    tipo: 'Filtro de Óleo 2',         nome: 'W11102 Mann Filter',               referencia: 'W11102',  fornecedor: 'Mann Filter' },
  { id: 'flt_700_LF3675_OL', tipo: 'Filtro de Óleo 1',         nome: 'Filtro óleo lubrificante LF3675',  referencia: 'LF 3675', fornecedor: 'Fleetguard'  },
]

export default function Filtros() {
  const { tipoPerfil } = useAuth()
  const { dados: filtros, carregando } = useCollection('filtros')
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState('geradores')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [modalEntrada, setModalEntrada] = useState(null)
  const [modalBaixa, setModalBaixa] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalSaida, setModalSaida] = useState(false)
  const [modalIguais, setModalIguais] = useState(false)

  const podeAdministrar = temPermissao(tipoPerfil, MODULOS.ESTOQUE) || tipoPerfil === PERFIS.ADMIN
  const [seeding, setSeeding] = useState(false)
  const ja700kva = useMemo(() => filtros.some(f => f.potenciaGG === '700kVA'), [filtros])

  async function adicionarFiltros700kVA() {
    setSeeding(true)
    try {
      const batch = writeBatch(db)
      for (const f of FILTROS_700KVA) {
        batch.set(doc(db, 'filtros', f.id), {
          potenciaGG: '700kVA',
          tipo: f.tipo,
          nome: f.nome,
          referencia: f.referencia,
          fornecedor: f.fornecedor,
          quantidadeAtual: 0,
          estoqueMin: 1,
          unidade: 'un',
          ativo: true,
          criadoEm: new Date(),
        })
      }
      await batch.commit()
    } catch (e) {
      alert('Erro ao adicionar filtros: ' + e.message)
    } finally {
      setSeeding(false)
    }
  }

  const filtrados = useMemo(() => {
    return filtros
      .filter(f => f.ativo !== false)
      .filter(f => filtroDaAba(f, aba))
      .filter(f => {
        if (!busca) return true
        const q = busca.toLowerCase()
        return f.nome?.toLowerCase().includes(q) || f.referencia?.toLowerCase().includes(q) || f.potenciaGG?.toLowerCase().includes(q)
      })
      .filter(f => {
        if (statusFiltro === 'Todos') return true
        const qtd = f.quantidadeAtual || 0
        const min = f.estoqueMin || 0
        if (statusFiltro === 'Crítico') return qtd <= 0
        if (statusFiltro === 'Baixo') return qtd > 0 && qtd <= min
        if (statusFiltro === 'OK') return qtd > min
        return true
      })
  }, [filtros, busca, statusFiltro, aba])

  const agrupados = useMemo(() => {
    const map = new Map()
    filtrados.forEach(f => {
      const key = f.potenciaGG || 'Outros'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(f)
    })
    return Array.from(map.entries()).sort(([a], [b]) => {
      const numA = parseInt(a) || Infinity
      const numB = parseInt(b) || Infinity
      return numA - numB
    })
  }, [filtrados])

  const stats = useMemo(() => {
    const base = filtros
      .filter(f => f.ativo !== false)
      .filter(f => filtroDaAba(f, aba))
    return {
      total: base.length,
      criticos: base.filter(f => (f.quantidadeAtual || 0) <= 0).length,
      baixos: base.filter(f => { const q = f.quantidadeAtual || 0; const m = f.estoqueMin || 0; return q > 0 && q <= m }).length,
    }
  }, [filtros, aba])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Filtros</h1>
          <p className="text-gray-500 text-sm mt-1">Estoque de filtros organizado por potência de gerador.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {tipoPerfil === PERFIS.ADMIN && !ja700kva && (
            <button onClick={adicionarFiltros700kVA} disabled={seeding} className="btn-secondary text-sm">
              {seeding ? 'Adicionando...' : '+ Filtros 700kVA'}
            </button>
          )}
          <button onClick={() => setModalIguais(true)} className="btn-secondary text-sm flex-shrink-0">
            Filtros iguais
          </button>
          <button onClick={() => setModalSaida(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Saída p/ Manutenção
          </button>
          {podeAdministrar && (
            <button onClick={() => setModalNovo(true)} className="btn-secondary flex-shrink-0">
              + Novo Filtro
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${aba === a.id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-black'}`}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total de filtros', valor: stats.total, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Estoque baixo', valor: stats.baixos, cor: stats.baixos > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700' },
          { label: 'Crítico / zerado', valor: stats.criticos, cor: stats.criticos > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input type="search" placeholder="Buscar por nome, referência ou potência..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPCOES.map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${statusFiltro === s ? 'bg-brand-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agrupados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔧</p>
          <p>Nenhum filtro encontrado.</p>
          {podeAdministrar && <button onClick={() => setModalNovo(true)} className="btn-primary mt-4 mx-auto">Cadastrar primeiro filtro</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {agrupados.map(([potencia, itens]) => (
            <div key={potencia}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-brand-black bg-brand-red/10 text-brand-red px-3 py-1 rounded-full">{potencia}</span>
                <span className="text-xs text-gray-400">{itens.length} {itens.length === 1 ? 'filtro' : 'filtros'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {itens.map(f => (
                  <FiltroCard key={f.id} filtro={f} filtros={filtros} onEntrada={setModalEntrada} onBaixa={setModalBaixa} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalEntrada && <EntradaFiltroModal filtro={modalEntrada} filtros={filtros} onFechar={() => setModalEntrada(null)} />}
      {modalBaixa && <BaixaFiltroModal filtro={modalBaixa} filtros={filtros} onFechar={() => setModalBaixa(null)} />}
      {modalNovo && <NovoFiltroModal onFechar={() => setModalNovo(false)} />}
      {modalSaida && <SaidaFiltrosModal onFechar={() => setModalSaida(false)} />}
      {modalIguais && <FiltrosIguaisModal filtros={filtros} onFechar={() => setModalIguais(false)} />}
    </div>
  )
}
