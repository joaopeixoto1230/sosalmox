import { useState } from 'react'
import DatePicker from '../../ui/DatePicker'
import { OPERADORES } from '../../../utils/operadores'

export default function StepEvento({ onSelecionar, onResponsavel, locacao = false }) {
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [operador, setOperador] = useState('')
  const [outroNome, setOutroNome] = useState('')
  const [mostrarOutro, setMostrarOutro] = useState(false)
  const [erro, setErro] = useState('')

  const responsavelFinal = mostrarOutro ? outroNome.trim() : operador

  // Locacao mensal e o mesmo documento de `eventos`, com tipo 'locacao_mensal'.
  // Documento sem o campo `tipo` continua contando como evento — mesma convencao
  // do `tipo` em ordens_saida (uso interno), sem migracao de dados.
  const txt = locacao
    ? {
        titulo: 'Nova Locação Mensal',
        subtitulo: 'Preencha os dados do contrato para iniciar a saída.',
        labelNome: 'Cliente / contrato *',
        placeholderNome: 'Ex: Construtora Alfa — Loja Centro',
        labelData: 'Início da locação *',
        erroNome: 'Nome do cliente / contrato é obrigatório',
        erroData: 'Data de início é obrigatória',
      }
    : {
        titulo: 'Novo Evento',
        subtitulo: 'Preencha os dados do evento para iniciar a saída.',
        labelNome: 'Nome do evento *',
        placeholderNome: 'Ex: Evento FIOTEC',
        labelData: 'Data *',
        erroNome: 'Nome do evento é obrigatório',
        erroData: 'Data é obrigatória',
      }

  // Nao grava o evento aqui: so leva os dados adiante. O evento so e criado
  // de fato na confirmacao da saida (StepConfirmacao), para que voltar/abandonar
  // o fluxo nao deixe eventos "fantasma" na aba de Eventos.
  function criarEvento() {
    if (!form.nome.trim()) { setErro(txt.erroNome); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro(txt.erroData); return }
    if (!responsavelFinal) { setErro('Selecione o responsável pelo material'); return }
    setErro('')
    onResponsavel(responsavelFinal)
    onSelecionar({
      novo: true,
      nome: form.nome.trim(),
      local: form.local.trim(),
      data: form.data,
      status: 'ativo',
      ...(locacao ? { tipo: 'locacao_mensal' } : {}),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">{txt.titulo}</h2>
        <p className="text-sm text-gray-500">{txt.subtitulo}</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{txt.labelNome}</label>
          <input
            value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            placeholder={txt.placeholderNome}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{txt.labelData}</label>
          <DatePicker
            value={form.data}
            onChange={v => setForm(p => ({ ...p, data: v }))}
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
          className="btn-primary w-full justify-center py-3 text-base"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
