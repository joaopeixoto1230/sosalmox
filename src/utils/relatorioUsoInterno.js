// Relatorio imprimivel da saida interna (Emprestimo/Consumo) — mesmo visual do
// romaneio da saida externa (StepMateriais.gerarRelatorio). Usado na tela de
// sucesso do UsoInternoFlow e na aba Historico do UsoInternoView.
//
// `assinatura` (opcional): doc de assinaturas_saida ou objeto local com
// { entregouNome, recebeuNome, entregouAssinatura, recebeuAssinatura } — quando
// ha imagem (dataURL) ela e impressa no lugar da linha de assinatura.
import { statusDevolucaoLabel } from './formatters'

export function gerarRelatorioUsoInterno(ordem, assinatura = null) {
  const subtipoLabel = ordem.subtipo === 'emprestimo' ? 'Empréstimo' : 'Consumo'
  const d = ordem.criadoEm?.toDate ? ordem.criadoEm.toDate() : ordem.criadoEm ? new Date(ordem.criadoEm) : new Date()
  const dataStr = isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
  const itens = ordem.itens || []

  const linhasItens = itens.map(it => `
    <tr>
      <td>${it.nome || '—'}${it.avulso ? ' <span class="tag">avulso</span>' : ''}</td>
      <td class="mono">${it.codigo || '—'}</td>
      <td>${it.quantidade || 1}${it.avulso && it.unidade ? ' ' + it.unidade : ''}</td>
      <td>${it.avulso ? 'Não cadastrado' : (it.categoria || '—')}</td>
    </tr>`).join('')

  const infoExtra = ordem.subtipo === 'emprestimo'
    ? `<p><span class="label">Devolução prevista:</span> ${ordem.dataPrevistaDevolucao ? new Date(ordem.dataPrevistaDevolucao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
       ${ordem.destinoMotivo ? `<p><span class="label">Destino/motivo:</span> ${ordem.destinoMotivo}</p>` : ''}`
    : `<p><span class="label">Motivo:</span> ${ordem.motivo || '—'}</p>`

  const blocoDevolucao = ordem.devolucao?.itens?.length ? `
    <h2 class="sec">Devolução registrada</h2>
    <table>
      <thead><tr><th>Item</th><th>Situação</th><th>Observação</th></tr></thead>
      <tbody>${ordem.devolucao.itens.map(it => `
        <tr><td>${it.nome || '—'}</td><td>${statusDevolucaoLabel(it.statusDevolucao)}</td><td>${it.descricao || '—'}</td></tr>`).join('')}
      </tbody>
    </table>` : ''

  const entregouNome = assinatura?.entregouNome || ordem.operadorNome || ''
  const recebeuNome = assinatura?.recebeuNome || ordem.responsavelNome || ''
  const blocoAssinatura = (label, quem, img) => `
    <div>
      ${img ? `<img class="ass-img" src="${img}"/>` : '<div class="assinatura-linha"></div>'}
      <div class="assinatura-label">${label}${quem ? ` — ${quem}` : ''}</div>
    </div>`

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>${ordem.numeroFormatado || 'Saída Interna'} — Uso Interno</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #CC0000; padding-bottom: 14px; margin-bottom: 18px; }
        .header-left h1 { color: #CC0000; font-size: 20px; font-weight: 800; }
        .header-left p { color: #666; font-size: 12px; margin-top: 2px; }
        .header-right { text-align: right; font-size: 12px; color: #555; }
        .header-right strong { font-size: 14px; color: #1a1a1a; display: block; }
        .info { margin-bottom: 14px; line-height: 1.7; }
        .label { color: #888; }
        .sec { font-size: 12px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.6px; margin: 18px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th { background: #f5f5f5; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.4px; }
        td { padding: 7px 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #fafafa; }
        .mono { font-family: monospace; color: #CC0000; font-size: 12px; }
        .tag { font-size: 10px; font-weight: 700; background: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 4px; }
        .total-linha { margin-top: 12px; font-weight: 700; font-size: 13px; }
        .assinaturas { margin-top: 44px; page-break-inside: avoid; }
        .assinaturas-titulo { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 28px; }
        .assinaturas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
        .assinatura-linha { border-bottom: 1.5px solid #1a1a1a; margin-bottom: 6px; height: 36px; }
        .ass-img { height: 60px; object-fit: contain; display: block; margin-bottom: 4px; }
        .assinatura-label { font-size: 11px; color: #888; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>SOS Energia</h1>
          <p>Saída Interna — ${subtipoLabel}</p>
        </div>
        <div class="header-right">
          <strong>${ordem.numeroFormatado || '—'}</strong>
          ${dataStr}
        </div>
      </div>

      <div class="info">
        <p><span class="label">Responsável:</span> <strong>${recebeuNome || '—'}</strong></p>
        <p><span class="label">Entregue por:</span> ${entregouNome || '—'}</p>
        ${infoExtra}
      </div>

      <table>
        <thead><tr><th>Material</th><th>Código</th><th>Qtd</th><th>Categoria</th></tr></thead>
        <tbody>${linhasItens || '<tr><td colspan="4" style="color:#aaa;text-align:center;padding:16px">Nenhum item.</td></tr>'}</tbody>
      </table>
      <p class="total-linha">Total: ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</p>

      ${blocoDevolucao}

      <div class="assinaturas">
        <div class="assinaturas-titulo">Assinaturas</div>
        <div class="assinaturas-grid">
          ${blocoAssinatura('Almoxarife — Entregou', entregouNome, assinatura?.entregouAssinatura || null)}
          ${blocoAssinatura('Responsável — Recebeu', recebeuNome, assinatura?.recebeuAssinatura || null)}
        </div>
      </div>

      <div class="footer">
        <span>Documento gerado em ${new Date().toLocaleString('pt-BR')}</span>
        <span>SOS Energia — Almoxarifado</span>
      </div>
    </body>
    </html>
  `
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.print()
}
