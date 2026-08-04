import { useState } from 'react'
import { db } from '../../firebase/config'
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { statusFiltroLabel, statusFiltroCor, formatarData } from '../../utils/formatters'
import { idsFiltrosIguais } from './filtrosUtils'

export default function FiltroCard({ filtro, filtros = [], onEntrada, onBaixa }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [ajustando, setAjustando] = useState(false)
  const [valorAjuste, setValorAjuste] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({ nome: '', referencia: '', fornecedor: '' })
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const iguaisIds = idsFiltrosIguais(filtros, filtro)
  const qtdIguais = iguaisIds.length - 1

  const { quantidadeAtual = 0, estoqueMin = 0, validade } = filtro
  const pct = estoqueMin > 0 ? Math.min(100, (quantidadeAtual / estoqueMin) * 100) : 100
  const critico = quantidadeAtual <= 0
  const baixo = !critico && quantidadeAtual <= estoqueMin
  const tileTint = critico ? 'bg-red-500/10 text-red-600' : baixo ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600'

  // separa "Filtro de Ar — GG-013" em descrição + selo do gerador (o GG fica no nome)
  const partesNome = (filtro.nome || '').split(/\s[—–-]\s/)
  const descricaoFiltro = partesNome[0] || ''
  const geradorRef = partesNome.length > 1 ? partesNome.slice(1).join(' — ') : ''

  const hoje = new Date()
  const dataVal = validade?.toDate ? validade.toDate() : validade ? new Date(validade) : null
  const diasVal = dataVal ? Math.ceil((dataVal - hoje) / 86400000) : null
  const vencendo = diasVal !== null && diasVal <= 30 && diasVal > 0
  const vencido = diasVal !== null && diasVal <= 0

  async function excluir() {
    setMenuAberto(false)
    if (!window.confirm(`Excluir "${filtro.nome}"? Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    try {
      await deleteDoc(doc(db, 'filtros', filtro.id))
    } finally {
      setExcluindo(false)
    }
  }

  function abrirAjuste() {
    setMenuAberto(false)
    setValorAjuste(String(quantidadeAtual))
    setEditando(false)
    setAjustando(true)
  }

  function abrirEdicao() {
    setMenuAberto(false)
    setFormEdit({
      nome: filtro.nome || '',
      referencia: filtro.referencia || '',
      fornecedor: filtro.fornecedor || '',
    })
    setAjustando(false)
    setEditando(true)
  }

  async function salvarEdicao() {
    const nome = formEdit.nome.trim()
    if (!nome) return
    setSalvandoEdit(true)
    try {
      // edição altera somente este filtro (nome/referência/fornecedor são próprios de cada card)
      await updateDoc(doc(db, 'filtros', filtro.id), {
        nome,
        referencia: formEdit.referencia.trim(),
        fornecedor: formEdit.fornecedor.trim(),
      })
      setEditando(false)
    } finally {
      setSalvandoEdit(false)
    }
  }

  async function salvarAjuste() {
    const nova = parseInt(valorAjuste)
    if (isNaN(nova) || nova < 0) return
    setSalvandoAjuste(true)
    try {
      // estoque compartilhado: todos os filtros iguais ficam com o mesmo valor
      const batch = writeBatch(db)
      iguaisIds.forEach(id => batch.update(doc(db, 'filtros', id), { quantidadeAtual: nova }))
      await batch.commit()
      setAjustando(false)
    } finally {
      setSalvandoAjuste(false)
    }
  }

  return (
    <div className={`card border-l-4 ${critico ? 'border-red-500' : baixo ? 'border-yellow-500' : 'border-green-500'} relative`}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tileTint}`}>
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {filtro.referencia ? (
            <>
              <p className="font-bold text-brand-black text-sm leading-tight font-mono truncate">{filtro.referencia}</p>
              {descricaoFiltro && <p className="text-xs text-gray-500 mt-0.5 truncate">{descricaoFiltro}</p>}
            </>
          ) : (
            <p className="font-semibold text-brand-black text-sm leading-tight">{descricaoFiltro || filtro.nome}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`badge ${statusFiltroCor(quantidadeAtual, estoqueMin)}`}>
            {statusFiltroLabel(quantidadeAtual, estoqueMin)}
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuAberto(v => !v)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden">
                  <button
                    onClick={() => { setMenuAberto(false); onEntrada(filtro) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    + Registrar Entrada
                  </button>
                  <button
                    onClick={() => { setMenuAberto(false); onBaixa(filtro) }}
                    disabled={quantidadeAtual <= 0}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Dar Baixa
                  </button>
                  <button
                    onClick={abrirAjuste}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Ajustar estoque
                  </button>
                  <button
                    onClick={abrirEdicao}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Editar filtro
                  </button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={excluir}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Excluir filtro
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {geradorRef && (
        <div className="inline-flex items-center mb-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
          {geradorRef}
        </div>
      )}

      {estoqueMin > 0 && (
        <div className="mb-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-gray-400">Estoque</span>
            <span className={`text-xs font-medium ${critico ? 'text-red-600' : baixo ? 'text-yellow-600' : 'text-brand-black'}`}>
              {quantidadeAtual}/{estoqueMin} {filtro.unidade || 'un'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${critico ? 'bg-red-500' : baixo ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {(vencendo || vencido) && dataVal && (
        <p className={`text-xs mb-2 font-medium ${vencido ? 'text-red-600' : 'text-yellow-600'}`}>
          {vencido ? `Vencido em ${formatarData(dataVal)}` : `Vence em ${diasVal} dias`}
        </p>
      )}

      {editando ? (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome / Descrição</label>
            <input
              value={formEdit.nome}
              onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))}
              className="input text-sm w-full"
              placeholder="Nome do filtro"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referência</label>
            <input
              value={formEdit.referencia}
              onChange={e => setFormEdit(p => ({ ...p, referencia: e.target.value }))}
              className="input text-sm w-full"
              placeholder="Ex: FS1006"
            />
            {qtdIguais > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                Mudar a referência altera o agrupamento de estoque compartilhado deste filtro.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
            <input
              value={formEdit.fornecedor}
              onChange={e => setFormEdit(p => ({ ...p, fornecedor: e.target.value }))}
              className="input text-sm w-full"
              placeholder="Fornecedor"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditando(false)} className="flex-1 text-xs btn-secondary py-1.5 justify-center">
              Cancelar
            </button>
            <button onClick={salvarEdicao} disabled={salvandoEdit || !formEdit.nome.trim()} className="flex-1 text-xs btn-primary py-1.5 justify-center">
              {salvandoEdit ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : ajustando ? (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <label className="block text-xs font-medium text-gray-600">Quantidade real em estoque</label>
          {qtdIguais > 0 && (
            <p className="text-xs text-blue-600">
              Aplicado também a {qtdIguais} filtro{qtdIguais > 1 ? 's' : ''} igual{qtdIguais > 1 ? 'is' : ''} (ref. {filtro.referencia}).
            </p>
          )}
          <input
            type="number" min="0" inputMode="numeric"
            value={valorAjuste}
            onChange={e => setValorAjuste(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && salvarAjuste()}
            className="input text-sm w-full"
            placeholder="0"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => setAjustando(false)} className="flex-1 text-xs btn-secondary py-1.5 justify-center">
              Cancelar
            </button>
            <button onClick={salvarAjuste} disabled={salvandoAjuste} className="flex-1 text-xs btn-primary py-1.5 justify-center">
              {salvandoAjuste ? 'Salvando...' : 'Salvar ajuste'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onEntrada(filtro)} className="flex-1 text-xs btn-primary py-1.5 justify-center">
            + Entrada
          </button>
          <button onClick={() => onBaixa(filtro)} className="flex-1 text-xs btn-secondary py-1.5 justify-center" disabled={quantidadeAtual <= 0}>
            Baixa
          </button>
        </div>
      )}

      {!editando && !ajustando && filtro.fornecedor && (
        <p className="text-xs text-gray-400 mt-2">{filtro.fornecedor}</p>
      )}

      {excluindo && (
        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
