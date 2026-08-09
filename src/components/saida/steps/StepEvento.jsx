import { useState } from 'react'
import DatePicker from '../../ui/DatePicker'
import { OPERADORES } from '../../../utils/operadores'

const TEXTOS = {
  evento: {
    titulo: 'Novo Evento',
    subtitulo: 'Preencha os dados do evento para iniciar a saída.',
    labelNome: 'Nome do evento *',
    placeholderNome: 'Ex: Evento FIOTEC',
    labelLocal: 'Local *',
    placeholderLocal: 'Ex: Brasília - DF',
    labelData: 'Data *',
    erroNome: 'Nome do evento é obrigatório',
    erroData: 'Data é obrigatória',
  },
  locacao: {
    titulo: 'Nova Locação Mensal',
    subtitulo: 'Preencha os dados do contrato para iniciar a saída.',
    labelNome: 'Cliente / contrato *',
    placeholderNome: 'Ex: Construtora Alfa — Loja Centro',
    labelLocal: 'Local *',
    placeholderLocal: 'Ex: Brasília - DF',
    labelData: 'Início da locação *',
    erroNome: 'Nome do cliente / contrato é obrigatório',
    erroData: 'Data de início é obrigatória',
  },
  sublocacao: {
    titulo: 'Nova Sublocação',
    subtitulo: 'Preencha os dados da empresa e de quem vem retirar.',
    labelNome: 'Empresa que está alugando *',
    placeholderNome: 'Ex: Rental Norte Locações Ltda',
    labelLocal: 'Local / destino *',
    placeholderLocal: 'Ex: Obra Porto Norte — Fortaleza/CE',
    labelData: 'Início da sublocação *',
    erroNome: 'Nome da empresa é obrigatório',
    erroData: 'Data de início é obrigatória',
  },
}

export default function StepEvento({ onSelecionar, onResponsavel, modo = 'evento' }) {
  const [form, setForm] = useState({ nome: '', local: '', data: '' })
  const [operador, setOperador] = useState('')
  const [outroNome, setOutroNome] = useState('')
  const [mostrarOutro, setMostrarOutro] = useState(false)
  // Sublocacao: quem retira e de FORA da SOS, entao o nome e digitado (nunca a
  // lista de operadores). Documento e telefone sao opcionais, para dar respaldo
  // caso o material nao volte.
  const [retirante, setRetirante] = useState({ nome: '', documento: '', telefone: '' })
  const [erro, setErro] = useState('')

  const ehSublocacao = modo === 'sublocacao'
  const txt = TEXTOS[modo] || TEXTOS.evento

  const responsavelFinal = ehSublocacao
    ? retirante.nome.trim()
    : (mostrarOutro ? outroNome.trim() : operador)

  // Locacao mensal e sublocacao sao o mesmo documento de `eventos`, com o campo
  // `tipo`. Documento sem `tipo` continua contando como evento — mesma convencao
  // do `tipo` em ordens_saida (uso interno), sem migracao de dados.
  const TIPO_POR_MODO = { locacao: 'locacao_mensal', sublocacao: 'sublocacao' }

  // Nao grava o evento aqui: so leva os dados adiante. O evento so e criado
  // de fato na confirmacao da saida (StepConfirmacao), para que voltar/abandonar
  // o fluxo nao deixe eventos "fantasma" na aba de Eventos.
  function criarEvento() {
    if (!form.nome.trim()) { setErro(txt.erroNome); return }
    if (!form.local.trim()) { setErro('Local é obrigatório'); return }
    if (!form.data) { setErro(txt.erroData); return }
    if (!responsavelFinal) {
      setErro(ehSublocacao ? 'Informe quem está retirando o material' : 'Selecione o responsável pelo material')
      return
    }
    setErro('')
    onResponsavel(responsavelFinal)
    onSelecionar({
      novo: true,
      nome: form.nome.trim(),
      local: form.local.trim(),
      data: form.data,
      status: 'ativo',
      ...(TIPO_POR_MODO[modo] ? { tipo: TIPO_POR_MODO[modo] } : {}),
      ...(ehSublocacao ? {
        retiradoPor: retirante.nome.trim(),
        retiradoDocumento: retirante.documento.trim() || null,
        retiradoTelefone: retirante.telefone.trim() || null,
      } : {}),
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{txt.labelLocal}</label>
          <input
            value={form.local}
            onChange={e => setForm(p => ({ ...p, local: e.target.value }))}
            placeholder={txt.placeholderLocal}
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

        {ehSublocacao ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quem está retirando *</label>
              <input
                value={retirante.nome}
                onChange={e => setRetirante(p => ({ ...p, nome: e.target.value }))}
                placeholder="Nome de quem veio buscar o material"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Pessoa da empresa que está alugando. Este nome vai para a assinatura de quem recebeu,
                para o link de assinatura e para o relatório.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento (opcional)</label>
                <input
                  value={retirante.documento}
                  onChange={e => setRetirante(p => ({ ...p, documento: e.target.value }))}
                  placeholder="RG ou CPF"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (opcional)</label>
                <input
                  value={retirante.telefone}
                  onChange={e => setRetirante(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="input"
                  inputMode="tel"
                />
              </div>
            </div>
          </div>
        ) : (
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
        )}

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
