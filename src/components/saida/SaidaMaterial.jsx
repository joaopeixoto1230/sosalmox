import { useState } from 'react'
import { materialPorQuantidade } from '../../utils/formatters'
import StepEvento from './steps/StepEvento'
import StepGerador from './steps/StepGerador'
import StepMateriais from './steps/StepMateriais'
import StepRomaneio from './steps/StepRomaneio'
import StepConfirmacao from './steps/StepConfirmacao'
import UsoInternoFlow from './usointerno/UsoInternoFlow'

const PASSOS_EVENTO = ['Evento', 'Gerador', 'Materiais', 'Romaneio', 'Confirmar']
const PASSOS_LOCACAO = ['Locação', 'Gerador', 'Materiais', 'Romaneio', 'Confirmar']

// Primeiro passo do modulo: escolher se a saida e para Evento (fluxo atual),
// Locacao Mensal (mesmo fluxo, gerador fica com status 'locacao') ou Uso Interno
// (emprestimo/consumo, sem vinculo a evento).
function EscolhaTipo({ onEscolher }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">Tipo de Saída</h2>
        <p className="text-sm text-gray-500">O material está saindo para quê?</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button onClick={() => onEscolher('evento')} className="card text-left hover:border-brand-red hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="font-bold text-brand-black">Evento</p>
          <p className="text-sm text-gray-500 mt-0.5">Aluguel/saída vinculada a um evento de cliente (fluxo com gerador e romaneio).</p>
        </button>
        <button onClick={() => onEscolher('locacao')} className="card text-left hover:border-purple-400 hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-bold text-brand-black">Locação Mensal</p>
          <p className="text-sm text-gray-500 mt-0.5">Contrato mensal com cliente. O gerador fica com status <strong>Em Locação</strong> até a devolução.</p>
        </button>
        <button onClick={() => onEscolher('uso_interno')} className="card text-left hover:border-brand-red hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h6m-6 4h6m-2 4h2" />
            </svg>
          </div>
          <p className="font-bold text-brand-black">Uso Interno</p>
          <p className="text-sm text-gray-500 mt-0.5">Empréstimo de ferramenta (que volta) ou consumo de material avulso (que não volta).</p>
        </button>
      </div>
    </div>
  )
}

function Stepper({ passos, passoAtual, podeProsseguir, onVoltar, onAvancar }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0 flex-1">
        {passos.map((p, i) => (
          <div key={p} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${i < passoAtual ? 'bg-green-500 text-white' : i === passoAtual ? 'bg-brand-red text-white' : 'bg-gray-200 text-gray-400'}
              `}>
                {i < passoAtual ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block font-medium ${i === passoAtual ? 'text-brand-red' : 'text-gray-400'}`}>
                {p}
              </span>
            </div>
            {i < passos.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < passoAtual ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 flex-shrink-0">
        <button
          onClick={onVoltar}
          disabled={passoAtual === 0}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onAvancar}
          disabled={!podeProsseguir || passoAtual === passos.length - 1}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function SaidaMaterial() {
  const [tipoSaida, setTipoSaida] = useState(null) // null | 'evento' | 'locacao' | 'uso_interno'
  const [passo, setPasso] = useState(0)
  const [evento, setEvento] = useState(null)
  const [geradores, setGeradores] = useState([])
  const [geradorConfirmado, setGeradorConfirmado] = useState(false)
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [observacoes, setObservacoes] = useState('')
  const [responsavel, setResponsavel] = useState('')

  function handleToggleItem(material, acao) {
    setItensSelecionados(prev =>
      acao === 'add'
        ? [...prev, materialPorQuantidade(material) ? { ...material, quantidade: 1 } : material]
        : prev.filter(i => i.id !== material.id)
    )
  }

  function handleQuantidadeItem(materialId, quantidade) {
    setItensSelecionados(prev =>
      prev.map(i => i.id === materialId ? { ...i, quantidade } : i)
    )
  }

  function handleRemoverDoRomaneio(materialId) {
    setItensSelecionados(prev => prev.filter(i => i.id !== materialId))
  }

  function resetar() {
    setPasso(0)
    setEvento(null)
    setGeradores([])
    setGeradorConfirmado(false)
    setItensSelecionados([])
    setObservacoes('')
    setResponsavel('')
  }

  // Locacao mensal usa exatamente o mesmo fluxo de 5 passos do evento; o que muda
  // e o vocabulario da tela e o status que o gerador assume na confirmacao.
  const ehLocacao = tipoSaida === 'locacao'
  const passos = ehLocacao ? PASSOS_LOCACAO : PASSOS_EVENTO

  const podeProsseguir = [
    evento !== null,
    geradorConfirmado,
    itensSelecionados.length > 0,
    itensSelecionados.length > 0,
    false,
  ][passo]

  function avancarPasso() {
    if (passo < passos.length - 1 && podeProsseguir) setPasso(p => p + 1)
  }

  function voltarPasso() {
    if (passo > 0) setPasso(p => p - 1)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-black">Saída de Material</h1>
        <p className="text-gray-500 text-sm mt-1">Registre a saída de materiais.</p>
      </div>

      {tipoSaida === null && <EscolhaTipo onEscolher={setTipoSaida} />}

      {tipoSaida === 'uso_interno' && (
        <UsoInternoFlow onTrocarTipo={() => setTipoSaida(null)} />
      )}

      {(tipoSaida === 'evento' || tipoSaida === 'locacao') && (
      <>
      {passo === 0 && (
        <button
          onClick={() => setTipoSaida(null)}
          className="text-sm text-gray-500 hover:text-brand-red inline-flex items-center gap-1 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Trocar tipo de saída
        </button>
      )}

      {ehLocacao && (
        <div className="mb-4 flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl px-3 py-2 text-sm">
          <span className="badge bg-purple-100 text-purple-700 flex-shrink-0">Locação Mensal</span>
          <span>Os geradores desta saída ficarão com o status <strong>Em Locação</strong>.</span>
        </div>
      )}

      <div className="card mb-6">
        <Stepper passos={passos} passoAtual={passo} podeProsseguir={podeProsseguir} onVoltar={voltarPasso} onAvancar={avancarPasso} />
      </div>

      {passo === 0 && (
        <StepEvento
          locacao={ehLocacao}
          onSelecionar={(evt) => { setEvento(evt); setPasso(1) }}
          onResponsavel={setResponsavel}
        />
      )}

      {passo === 1 && (
        <StepGerador
          onSelecionar={(ggs) => { setGeradores(ggs); setGeradorConfirmado(true); setPasso(2) }}
          onVoltar={() => setPasso(0)}
        />
      )}

      {passo === 2 && (
        <StepMateriais
          evento={evento}
          itensSelecionados={itensSelecionados}
          onToggle={handleToggleItem}
          onQuantidade={handleQuantidadeItem}
          onAvancar={() => setPasso(3)}
          onVoltar={() => setPasso(1)}
        />
      )}

      {passo === 3 && (
        <StepRomaneio
          evento={evento}
          geradores={geradores}
          itens={itensSelecionados}
          observacoes={observacoes}
          responsavel={responsavel}
          onObservacoes={setObservacoes}
          onResponsavel={setResponsavel}
          onRemover={handleRemoverDoRomaneio}
          onAvancar={() => setPasso(4)}
          onVoltar={() => setPasso(2)}
        />
      )}

      {passo === 4 && (
        <StepConfirmacao
          evento={evento}
          geradores={geradores}
          itens={itensSelecionados}
          observacoes={observacoes}
          responsavel={responsavel}
          onNovaSaida={resetar}
        />
      )}
      </>
      )}
    </div>
  )
}
