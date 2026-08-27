import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useDocument, useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao, MODULOS } from '../../utils/permissions'
import { statusGeradorLabel, statusGeradorCor, statusOsLabel, statusOsCor, formatarData, formatarDataHora } from '../../utils/formatters'
import { where } from 'firebase/firestore'

export default function DetalheGG() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tipoPerfil } = useAuth()
  const { dado: gg, carregando } = useDocument('geradores', id)
  const { dados: ordens } = useCollection('ordens_servico', [where('equipamentoId', '==', id || '_')], id)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)

  const podeEditar = ['admin', 'gerente', 'almoxarife', 'franca'].includes(tipoPerfil)
  const podeVender = ['admin', 'gerente'].includes(tipoPerfil)

  function iniciarEdicao() {
    setForm({
      potencia: gg.potencia || '',
      marca: gg.marca || '',
      modelo: gg.modelo || '',
      ano: gg.ano || '',
      horimetroAtual: gg.horimetroAtual ?? '',
      semHorimetro: gg.semHorimetro || false,
      // Ficha técnica (dados de placa). Antes só dava para VER esses campos —
      // nenhuma tela gravava neles, então placa nova não tinha onde entrar.
      motor: gg.motor || '',
      alternador: gg.alternador || '',
      tensao: gg.tensao || '',
      frequencia: gg.frequencia || '',
      fatorPotencia: gg.fatorPotencia || '',
      numSerie: gg.numSerie || '',
      numSerieMotor: gg.numSerieMotor || '',
      numSerieAlternador: gg.numSerieAlternador || '',
      fabricante: gg.fabricante || '',
      painel: gg.painel || '',
      cor: gg.cor || '',
      corrente: gg.corrente || '',
      peso: gg.peso || '',
    })
    setEditando(true)
  }

  async function salvarEdicao() {
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'geradores', id), {
        potencia: form.potencia,
        marca: form.marca,
        modelo: form.modelo,
        ano: form.ano,
        motor: form.motor.trim() || null,
        alternador: form.alternador.trim() || null,
        tensao: form.tensao.trim() || null,
        frequencia: form.frequencia.trim() || null,
        fatorPotencia: form.fatorPotencia.trim() || null,
        numSerie: form.numSerie.trim() || null,
        numSerieMotor: form.numSerieMotor.trim() || null,
        numSerieAlternador: form.numSerieAlternador.trim() || null,
        fabricante: form.fabricante.trim() || null,
        painel: form.painel.trim() || null,
        cor: form.cor.trim() || null,
        corrente: form.corrente.trim() || null,
        peso: form.peso.trim() || null,
        semHorimetro: form.semHorimetro,
        horimetroAtual: form.semHorimetro ? null : (form.horimetroAtual === '' ? null : Number(form.horimetroAtual)),
        atualizadoEm: serverTimestamp(),
      })
      setEditando(false)
    } finally {
      setSalvando(false)
    }
  }

  // Dados lidos das placas físicas do GG-15 (Brasil Geradores SLIM 110 + placa
  // WEG do alternador). O deploy não altera banco, então a atualização entra
  // por este botão de migração — admin only, some depois de aplicado (mesmo
  // padrão do "+ Filtros 700kVA"). O cadastro antigo (Olympian 120kVA) era de
  // outra máquina. Ano, painel, cor e horímetro não são tocados.
  const PLACA_GG15 = {
    potencia: '110kVA',
    marca: 'BRG Geradores',
    modelo: 'SLIM 110',
    motor: 'FPT NEF 45',
    alternador: 'WEG GTA202AI34 B15T',
    tensao: '440/380/220V',
    frequencia: '60 Hz',
    fatorPotencia: '0,8',
    numSerie: '3737',
    numSerieMotor: '6249230',
    numSerieAlternador: '1064884147 12 21',
    // A máquina é branca (confirmado pelo João). O resto do cadastro antigo
    // (Olympian 2001) sai de vez: era de outra máquina, e ano/painel/corrente/
    // peso da atual não constam nas placas — melhor vazio do que errado.
    cor: 'Branco',
    ano: null,
    painel: null,
    fabricante: null,
    corrente: null,
    peso: null,
  }
  const migracaoGG15Pendente =
    tipoPerfil === 'admin'
    && ['GG-015', 'GG-15'].includes(gg?.codigo)
    && (gg?.marca !== PLACA_GG15.marca || gg?.cor !== PLACA_GG15.cor)

  async function aplicarPlacaGG15() {
    setSalvando(true)
    try {
      await updateDoc(doc(db, 'geradores', id), { ...PLACA_GG15, atualizadoEm: serverTimestamp() })
    } finally {
      setSalvando(false)
    }
  }

  async function toggleDefeito() {
    const temDefeito = !gg.temDefeito
    await updateDoc(doc(db, 'geradores', id), {
      temDefeito,
      status: temDefeito ? 'defeito' : 'disponivel',
      defeito: temDefeito ? (gg.defeito || '') : '',
    })
  }

  async function marcarVendido() {
    if (!confirm(`Marcar ${gg.codigo} como vendido? Ele sairá das listas operacionais.`)) return
    await updateDoc(doc(db, 'geradores', id), { status: 'inativo', ativo: false })
    navigate('/geradores')
  }

  if (carregando) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!gg) return <div className="text-center py-12 text-gray-400"><p>Gerador não encontrado.</p></div>

  const historico = ordens.sort((a, b) => {
    const ta = a.dataAbertura?.toDate ? a.dataAbertura.toDate() : new Date(a.dataAbertura || 0)
    const tb = b.dataAbertura?.toDate ? b.dataAbertura.toDate() : new Date(b.dataAbertura || 0)
    return tb - ta
  })

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/geradores')} className="btn-ghost px-2">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-brand-black">{gg.codigo}</h1>
            <span className={`badge ${statusGeradorCor(gg.status)}`}>{statusGeradorLabel(gg.status)}</span>
          </div>
          <p className="text-gray-500 text-sm">{gg.potencia} • {gg.marca} {gg.modelo} {gg.ano && `(${gg.ano})`}</p>
        </div>
        {podeEditar && !editando && (
          <button onClick={iniciarEdicao} className="btn-secondary text-sm">Editar</button>
        )}
      </div>

      {editando ? (
        <div className="card space-y-3">
          <h2 className="font-semibold text-brand-black">Editar dados</h2>
          {[['potencia', 'Potência', 'Ex: 100kVA'], ['marca', 'Marca', 'Ex: Cummins'], ['modelo', 'Modelo', 'Ex: C100D5'], ['ano', 'Ano', 'Ex: 2018']].map(([k, label, ph]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} className="input" placeholder={ph} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Horímetro</label>
            <input
              type="number"
              min="0"
              value={form.semHorimetro ? '' : form.horimetroAtual}
              onChange={e => setForm(p => ({ ...p, horimetroAtual: e.target.value }))}
              disabled={form.semHorimetro}
              className="input disabled:bg-gray-100 disabled:text-gray-400"
              placeholder={form.semHorimetro ? 'Sem horímetro' : 'Ex: 1230'}
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.semHorimetro}
                onChange={e => setForm(p => ({ ...p, semHorimetro: e.target.checked }))}
                className="w-4 h-4 accent-brand-red"
              />
              <span className="text-sm text-gray-600">Este gerador não possui horímetro</span>
            </label>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ficha técnica (placas)</p>
            <div className="grid grid-cols-2 gap-3">
              {[['motor', 'Motor', 'Ex: FPT NEF 45'], ['alternador', 'Alternador', 'Ex: WEG GTA202AI34'],
                ['tensao', 'Tensão', 'Ex: 440/380/220V'], ['frequencia', 'Frequência', 'Ex: 60 Hz'],
                ['fatorPotencia', 'Fator de potência', 'Ex: 0,8'], ['numSerie', 'Nº de série', ''],
                ['numSerieMotor', 'Nº série motor', ''], ['numSerieAlternador', 'Nº série alternador', ''],
                ['fabricante', 'Fabricante', ''], ['painel', 'Painel', 'Ex: Analógico'],
                ['cor', 'Cor', 'Ex: Branco'], ['corrente', 'Corrente', ''], ['peso', 'Peso', '']].map(([k, label, ph]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} className="input" placeholder={ph} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEditando(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={salvarEdicao} disabled={salvando} className="btn-primary flex-1 justify-center">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Localização</p><p className="font-medium">{gg.localizacao || 'Pátio SOS'}</p></div>
            <div><p className="text-gray-400 text-xs">Horímetro</p><p className="font-medium">{gg.semHorimetro ? 'Sem horímetro' : `${(gg.horimetroAtual || 0).toLocaleString('pt-BR')}h`}</p></div>
            {gg.ultimaManutencao && <div><p className="text-gray-400 text-xs">Última manutenção</p><p className="font-medium">{formatarData(gg.ultimaManutencao)}</p></div>}
            {gg.proximaPreventiva && <div><p className="text-gray-400 text-xs">Próxima preventiva</p><p className="font-medium">{formatarData(gg.proximaPreventiva)}</p></div>}
          </div>

          {gg.temDefeito && gg.defeito && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Defeito registrado</p>
              <p className="text-sm text-red-600">{gg.defeito}</p>
            </div>
          )}

          {podeEditar && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button onClick={toggleDefeito}
                className={`flex-1 text-sm py-1.5 rounded-lg border font-medium transition-colors ${gg.temDefeito ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' : 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'}`}>
                {gg.temDefeito ? '✓ Resolver defeito' : '⚠ Marcar defeito'}
              </button>
              {podeVender && (
                <button onClick={marcarVendido} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  Vendido
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {migracaoGG15Pendente && (
        <div className="card border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Dados das placas do GG-15</p>
          <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-1">
            Atualiza para BRG Geradores SLIM 110 (110kVA), motor FPT NEF 45, alternador WEG,
            números de série e cor branca — e apaga o que sobrou do cadastro antigo
            (ano, painel, corrente, peso). O horímetro não muda.
          </p>
          <button onClick={aplicarPlacaGG15} disabled={salvando} className="btn-primary text-sm mt-3">
            {salvando ? 'Aplicando...' : 'Aplicar dados das placas'}
          </button>
        </div>
      )}

      {(() => {
        const campos = [
          ['fabricante', 'Fabricante'],
          ['motor', 'Motor'],
          ['alternador', 'Alternador'],
          ['painel', 'Painel'],
          ['cor', 'Cor'],
          ['tensao', 'Tensão'],
          ['frequencia', 'Frequência'],
          ['fatorPotencia', 'Fator de potência'],
          ['corrente', 'Corrente'],
          ['peso', 'Peso'],
          ['numSerie', 'Nº de série'],
          ['numSerieMotor', 'Nº série motor'],
          ['numSerieAlternador', 'Nº série alternador'],
        ].filter(([k]) => gg[k] != null && String(gg[k]).trim() !== '')
        if (!campos.length) return null
        return (
          <div className="card">
            <h2 className="font-semibold text-brand-black mb-3">Ficha técnica</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {campos.map(([k, label]) => (
                <div key={k}>
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className="font-medium break-words">{String(gg[k])}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="card">
        <h2 className="font-semibold text-brand-black mb-3">Histórico de Manutenção ({historico.length})</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma OS registrada.</p>
        ) : (
          <div className="space-y-2">
            {historico.map(os => (
              <button key={os.id} onClick={() => navigate(`/manutencao/${os.id}`)}
                className="w-full text-left px-3 py-2 rounded-xl border border-gray-100 hover:border-brand-red hover:bg-red-50/30 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-brand-red">{os.numero}</p>
                    <p className="text-sm font-medium text-brand-black">{os.descricao}</p>
                    <p className="text-xs text-gray-400">{formatarData(os.dataAbertura)} • {os.tipo}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusOsCor(os.status)}`}>{statusOsLabel(os.status)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
