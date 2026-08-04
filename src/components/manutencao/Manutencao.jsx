import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection } from '../../hooks/useFirestore'
import { statusOsLabel, statusOsCor, formatarData } from '../../utils/formatters'
import OSCard from './OSCard'

const STATUS_OPCOES = ['Todos', 'Pendente', 'Em Andamento', 'Concluída']
const STATUS_MAP = { 'Pendente': 'pendente', 'Em Andamento': 'em_andamento', 'Concluída': 'concluida' }
const TIPO_EQUIP = { gerador: 'Gerador', caminhao: 'Veículo', empilhadeira: 'Empilhadeira' }

const toDate = v => (v?.toDate ? v.toDate() : (v ? new Date(v) : null))
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inicioDia = str => { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0) }
const fimDia = str => { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999) }

// presets relativos a hoje — preenchem os campos De/Até (sempre editáveis depois)
function periodoPreset(chave) {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth()
  if (chave === 'mes') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  if (chave === 'trimestre') { const q = Math.floor(m / 3) * 3; return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))] }
  if (chave === 'semestre') { const s = m < 6 ? 0 : 6; return [iso(new Date(y, s, 1)), iso(new Date(y, s + 6, 0))] }
  if (chave === 'ano') return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))]
  return ['', '']
}

export default function Manutencao() {
  const navigate = useNavigate()
  const { dados: ordens, carregando } = useCollection('ordens_servico')
  const [statusFiltro, setStatusFiltro] = useState('Todos')
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const filtradas = useMemo(() => {
    return ordens
      .filter(o => {
        // período = data de conclusão (só OS concluídas entram quando há período)
        if (de || ate) {
          if (o.status !== 'concluida') return false
          const dc = toDate(o.dataConclusao)
          if (!dc) return false
          if (de && dc < inicioDia(de)) return false
          if (ate && dc > fimDia(ate)) return false
        }
        if (statusFiltro !== 'Todos' && o.status !== STATUS_MAP[statusFiltro]) return false
        if (tipoFiltro !== 'Todos' && o.tipo !== tipoFiltro.toLowerCase()) return false
        if (busca) {
          const q = busca.toLowerCase()
          return o.equipamentoLabel?.toLowerCase().includes(q) || o.numero?.toLowerCase().includes(q) || o.descricao?.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => {
        if (a.prioridade === 'maxima' && b.prioridade !== 'maxima') return -1
        if (b.prioridade === 'maxima' && a.prioridade !== 'maxima') return 1
        const ta = a.dataAbertura?.toDate ? a.dataAbertura.toDate() : new Date(a.dataAbertura || 0)
        const tb = b.dataAbertura?.toDate ? b.dataAbertura.toDate() : new Date(b.dataAbertura || 0)
        return tb - ta
      })
  }, [ordens, statusFiltro, tipoFiltro, busca, de, ate])

  function aplicarPreset(chave) {
    const [d, a] = periodoPreset(chave)
    setDe(d); setAte(a)
  }

  const periodoAtivo = !!(de || ate)

  function baixarPlanilha() {
    if (!filtradas.length) return
    const cabecalho = ['Nº OS', 'Equipamento', 'Tipo equip.', 'Tipo manut.', 'Status', 'Prioridade', 'Abertura', 'Conclusão', 'Mecânico', 'Cliente/Oficina', 'Local', 'Peças (filtros)', 'Descrição']
    const localTexto = o => o.localTipo === 'locacao'
      ? (o.equipamentoTipo === 'caminhao' ? 'Oficina externa' : 'Locação')
      : 'Pátio SOS'
    const pecasTexto = o => (o.filtrosUsados || [])
      .map(f => `${f.filtroNome || f.nome || '—'} x${f.quantidade || f.qtdUsada || 1}`)
      .join(' | ')
    const linhas = filtradas.map(o => [
      o.numero || '',
      o.equipamentoLabel || '',
      TIPO_EQUIP[o.equipamentoTipo] || o.equipamentoTipo || '',
      o.tipo ? o.tipo.charAt(0).toUpperCase() + o.tipo.slice(1) : '',
      statusOsLabel(o.status),
      o.prioridade === 'maxima' ? 'Urgente' : 'Normal',
      o.dataAbertura ? formatarData(o.dataAbertura) : '',
      o.dataConclusao ? formatarData(o.dataConclusao) : '',
      o.mecanicoNome || '',
      o.clienteNome || '',
      localTexto(o),
      pecasTexto(o),
      o.descricao || '',
    ])
    const esc = v => {
      const s = String(v ?? '')
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const conteudo = '﻿' + [cabecalho, ...linhas].map(l => l.map(esc).join(';')).join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `manutencoes${de ? '_' + de : ''}${ate ? '_a_' + ate : ''}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function gerarRelatorio() {
    if (!filtradas.length) return
    const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const fmtDia = str => { const [y, m, d] = str.split('-'); return `${d}/${m}/${y}` }
    const periodoLabel = (de || ate)
      ? `${de ? fmtDia(de) : 'início'} a ${ate ? fmtDia(ate) : 'hoje'}`
      : 'Todos os registros'

    const blocos = filtradas.map(o => {
      const localTxt = o.localTipo === 'locacao'
        ? (o.equipamentoTipo === 'caminhao' ? `Oficina externa${o.clienteNome ? ' — ' + esc(o.clienteNome) : ''}` : `Locação${o.clienteNome ? ' — ' + esc(o.clienteNome) : ''}`)
        : 'Pátio SOS'
      const pecas = (o.filtrosUsados || []).length
        ? `<table><thead><tr><th>Peça / filtro</th><th style="text-align:center">Qtd</th></tr></thead><tbody>${o.filtrosUsados.map(f => `<tr><td>${esc(f.filtroNome || f.nome || '—')}</td><td style="text-align:center">${f.quantidade || f.qtdUsada || 1}</td></tr>`).join('')}</tbody></table>`
        : '<p class="vazio">Nenhuma peça registrada.</p>'
      return `
      <div class="os">
        <div class="os-head">
          <span class="num">${esc(o.numero || '—')}</span>
          <span class="equip">${esc(o.equipamentoLabel || '')} <em>(${TIPO_EQUIP[o.equipamentoTipo] || o.equipamentoTipo || '—'})</em></span>
          <span class="badge">${statusOsLabel(o.status)}</span>
        </div>
        <div class="meta">
          <span><b>Tipo:</b> ${o.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}</span>
          <span><b>Mecânico:</b> ${esc(o.mecanicoNome || '—')}</span>
          <span><b>Local:</b> ${localTxt}</span>
          <span><b>Abertura:</b> ${formatarData(o.dataAbertura)}</span>
          <span><b>Conclusão:</b> ${o.dataConclusao ? formatarData(o.dataConclusao) : '—'}</span>
        </div>
        ${o.descricao ? `<p class="sec">Descrição</p><p class="txt">${esc(o.descricao)}</p>` : ''}
        ${o.relatorioServico ? `<p class="sec">Relatório do serviço executado</p><p class="txt">${esc(o.relatorioServico)}</p>` : ''}
        ${o.problemasEncontrados ? `<p class="sec prob">Problemas encontrados</p><p class="txt prob-box">${esc(o.problemasEncontrados)}</p>` : ''}
        ${o.proximaPreventiva ? `<p class="sec">Próxima preventiva</p><p class="txt prev">${esc(o.proximaPreventiva)}</p>` : ''}
        <p class="sec">Peças utilizadas</p>${pecas}
      </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Manutenções</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111; max-width: 720px; margin: 0 auto; font-size: 13px; }
    .cab { border-bottom: 2px solid #CC0000; padding-bottom: 12px; margin: 18px 0 4px; }
    .cab h1 { color: #CC0000; margin: 0; font-size: 20px; }
    .cab p { margin: 4px 0 0; color: #555; font-size: 12px; }
    .os { border: 1px solid #e2e2e2; border-radius: 8px; padding: 12px 14px; margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
    .os-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px; }
    .os-head .num { font-weight: bold; color: #CC0000; font-family: monospace; font-size: 13px; }
    .os-head .equip { flex: 1; font-weight: 600; }
    .os-head .equip em { color: #888; font-weight: 400; font-style: normal; font-size: 11px; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #e5f5e5; color: #2a7a2a; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 11px; color: #444; margin-bottom: 6px; }
    .meta b { color: #888; font-weight: 600; }
    .sec { font-size: 10px; font-weight: bold; color: #666; margin: 10px 0 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sec.prob { color: #c05000; }
    .txt { font-size: 12.5px; margin: 0; white-space: pre-wrap; }
    .txt.prob-box { color: #c05000; background: #fff7ed; padding: 6px 10px; border-radius: 6px; }
    .txt.prev { font-weight: bold; color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
    th { background: #f0f0f0; text-align: left; padding: 5px 9px; border-bottom: 2px solid #ccc; }
    td { padding: 4px 9px; border-bottom: 1px solid #eee; }
    .vazio { font-size: 12px; color: #999; margin: 2px 0; }
    .footer { margin-top: 18px; font-size: 10px; color: #aaa; text-align: right; }
  </style>
</head>
<body>
  <div class="cab">
    <h1>SOS Energia — Relatório de Manutenções</h1>
    <p>Período (conclusão): <b>${periodoLabel}</b> &nbsp;•&nbsp; ${filtradas.length} ${filtradas.length === 1 ? 'serviço' : 'serviços'}</p>
  </div>
  ${blocos}
  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`

    // imprime por iframe oculto (mesmo padrão do PDF da OS — não abre aba nova)
    const anterior = document.getElementById('os-relatorio-frame')
    if (anterior) anterior.remove()
    const iframe = document.createElement('iframe')
    iframe.id = 'os-relatorio-frame'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    iframe.onload = () => {
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch { /* ignore */ }
        setTimeout(() => iframe.remove(), 60000)
      }, 300)
    }
    document.body.appendChild(iframe)
    iframe.srcdoc = html
  }

  const stats = useMemo(() => {
    const agora = new Date()
    const limiteAtrasada = 2 * 24 * 60 * 60 * 1000
    const atrasadas = ordens.filter(o => {
      if (o.status === 'concluida') return false
      const d = o.dataAbertura?.toDate ? o.dataAbertura.toDate() : new Date(o.dataAbertura || 0)
      return (agora - d) >= limiteAtrasada
    })
    return {
      abertas: ordens.filter(o => o.status === 'pendente' || o.status === 'em_andamento').length,
      urgentes: ordens.filter(o => o.prioridade === 'maxima' && o.status !== 'concluida').length,
      concluidas: ordens.filter(o => o.status === 'concluida').length,
      atrasadas,
    }
  }, [ordens])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Manutenção</h1>
          <p className="text-gray-500 text-sm mt-1">Ordens de serviço de geradores, caminhões e empilhadeiras.</p>
        </div>
        <button onClick={() => navigate('/manutencao/nova')} className="btn-primary flex-shrink-0">
          + Nova OS
        </button>
      </div>

      {stats.atrasadas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-red">
              {stats.atrasadas.length} {stats.atrasadas.length === 1 ? 'OS sem conclusão' : 'OS sem conclusão'} há mais de 2 dias
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {stats.atrasadas.map(o => o.numero).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'OS Abertas', valor: stats.abertas, cor: 'bg-blue-50 text-blue-700' },
          { label: 'Urgentes', valor: stats.urgentes, cor: stats.urgentes > 0 ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-green-700' },
          { label: 'Concluídas', valor: stats.concluidas, cor: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`card ${s.cor} border-0`}>
            <p className="text-2xl font-bold">{s.valor}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input type="search" placeholder="Buscar por equipamento, OS ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="input" />
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPCOES.map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${statusFiltro === s ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
              {s}
            </button>
          ))}
          <div className="h-6 w-px bg-gray-200 self-center" />
          {['Todos', 'Preventiva', 'Corretiva'].map(t => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${tipoFiltro === t ? 'bg-brand-black text-white border-brand-black' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-gray-500">Período (por data de conclusão)</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={gerarRelatorio} disabled={!filtradas.length}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                ↓ Baixar relatório ({filtradas.length})
              </button>
              <button onClick={baixarPlanilha} disabled={!filtradas.length}
                className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                ↓ Planilha (.csv)
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['mes', 'Este mês'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['ano', 'Ano']].map(([chave, label]) => (
              <button key={chave} onClick={() => aplicarPreset(chave)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red transition-colors">
                {label}
              </button>
            ))}
            {periodoAtivo && (
              <button onClick={() => { setDe(''); setAte('') }}
                className="px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-400 hover:text-brand-red hover:border-brand-red transition-colors">
                Limpar
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-xs text-gray-500">De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className="input py-1.5 w-auto" />
            <label className="text-xs text-gray-500">Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="input py-1.5 w-auto" />
          </div>
          {periodoAtivo && (
            <p className="text-xs text-gray-400">
              Mostrando apenas OS <span className="font-medium">concluídas</span> no período — {filtradas.length} {filtradas.length === 1 ? 'OS' : 'OS'}.
            </p>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" /></div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔧</p>
          <p>Nenhuma OS encontrada.</p>
          <button onClick={() => navigate('/manutencao/nova')} className="btn-primary mt-4 mx-auto">Abrir primeira OS</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filtradas.length} {filtradas.length === 1 ? 'ordem encontrada' : 'ordens encontradas'}</p>
          <div className="space-y-3">
            {filtradas.map(os => <OSCard key={os.id} os={os} />)}
          </div>
        </>
      )}
    </div>
  )
}
