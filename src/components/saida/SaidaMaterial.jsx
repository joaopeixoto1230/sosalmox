import { useState } from 'react'
import StepEvento from './steps/StepEvento'
import StepGerador from './steps/StepGerador'
import StepMateriais from './steps/StepMateriais'
import StepRomaneio from './steps/StepRomaneio'
import StepConfirmacao from './steps/StepConfirmacao'

const PASSOS = ['Evento', 'Gerador', 'Materiais', 'Romaneio', 'Confirmar']

function Stepper({ passoAtual }) {
  return (
    <div className="flex items-center gap-0">
      {PASSOS.map((p, i) => (
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
          {i < PASSOS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < passoAtual ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function SaidaMaterial() {
  const [passo, setPasso] = useState(0)
  const [evento, setEvento] = useState(null)
  const [gerador, setGerador] = useState(null)
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [observacoes, setObservacoes] = useState('')

  function handleToggleItem(material, acao) {
    setItensSelecionados(prev =>
      acao === 'add'
        ? [...prev, material]
        : prev.filter(i => i.id !== material.id)
    )
  }

  function handleRemoverDoRomaneio(materialId) {
    setItensSelecionados(prev => prev.filter(i => i.id !== materialId))
  }

  function resetar() {
    setPasso(0)
    setEvento(null)
    setGerador(null)
    setItensSelecionados([])
    setObservacoes('')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-black">Saída de Material</h1>
        <p className="text-gray-500 text-sm mt-1">Registre a saída de materiais para um evento.</p>
      </div>

      <div className="card mb-6">
        <Stepper passoAtual={passo} />
      </div>

      {passo === 0 && (
        <StepEvento
          onSelecionar={(evt) => { setEvento(evt); setPasso(1) }}
        />
      )}

      {passo === 1 && (
        <StepGerador
          evento={evento}
          onSelecionar={(gg) => { setGerador(gg); setPasso(2) }}
          onVoltar={() => setPasso(0)}
        />
      )}

      {passo === 2 && (
        <StepMateriais
          evento={evento}
          itensSelecionados={itensSelecionados}
          onToggle={handleToggleItem}
          onAvancar={() => setPasso(3)}
          onVoltar={() => setPasso(1)}
        />
      )}

      {passo === 3 && (
        <StepRomaneio
          evento={evento}
          gerador={gerador}
          itens={itensSelecionados}
          observacoes={observacoes}
          onObservacoes={setObservacoes}
          onRemover={handleRemoverDoRomaneio}
          onAvancar={() => setPasso(4)}
          onVoltar={() => setPasso(2)}
        />
      )}

      {passo === 4 && (
        <StepConfirmacao
          evento={evento}
          gerador={gerador}
          itens={itensSelecionados}
          observacoes={observacoes}
          onNovaSaida={resetar}
        />
      )}
    </div>
  )
}
