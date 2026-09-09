import { SECOES, VERSAO } from './conteudoPlaybook'
import { EMPRESA } from '../../utils/empresa'
import { imprimirComNome } from '../../utils/impressao'

// Versão impressa do Playbook: capa com timbre, sumário numerado e um capítulo
// por página. Sai do MESMO conteúdo da tela (conteudoPlaybook.js) — duas
// escritas separadas envelheceriam em ritmos diferentes.
//
// Impressão por iframe oculto, igual aos outros relatórios do sistema: abrir
// aba nova travava o computador ao voltar.

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

function bloco(b) {
  if (b.p) return `<p>${esc(b.p)}</p>`
  if (b.lista) return `<ul>${b.lista.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
  if (b.passos) return `<ol>${b.passos.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`
  if (b.atencao) return `<div class="box atencao"><span class="rot">Atenção</span>${esc(b.atencao)}</div>`
  if (b.dica) return `<div class="box dica"><span class="rot">Dica</span>${esc(b.dica)}</div>`
  if (b.tabela) {
    return `<table>
      <thead><tr>${b.tabela.cabecalho.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${b.tabela.linhas.map(l => `<tr>${l.map((c, i) =>
        `<td${i === 0 ? ' class="primeira"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`
  }
  return ''
}

// Logo oficial servido pelo hosting. O iframe de impressão herda a base do
// documento, então o caminho absoluto resolve. Trocar a imagem exige subir o
// sufixo do arquivo (-v3 etc.) — ver a nota de cache no CLAUDE.md.
const LOGO = '/logo-sos-v2.png'

export function imprimirPlaybook() {
  const hoje = new Date().toLocaleDateString('pt-BR')

  const sumario = SECOES.map((s, i) =>
    `<li><span class="n">${i + 1}</span> ${esc(s.titulo)}</li>`).join('')

  const capitulos = SECOES.map((s, i) => `
    <section class="cap">
      <h2><span class="num">${i + 1}</span> ${esc(s.titulo)}</h2>
      ${s.blocos.map(bloco).join('')}
    </section>`).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Playbook do Almoxarifado — SOS Energia</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #1a1a1a; margin: 0; font-size: 11.5pt; line-height: 1.55;
    }

    /* ===== Capa ===== */
    .capa { height: 246mm; display: flex; flex-direction: column; justify-content: center;
            text-align: center; page-break-after: always; }
    .capa .marca img { width: 62mm; height: auto; display: block; margin: 0 auto; }
    .capa .sub { font-size: 12pt; color: #666; margin-top: 8px; letter-spacing: 3px; text-transform: uppercase; }
    .capa h1 { font-size: 30pt; margin: 42px 0 8px; color: #0A0A0A; line-height: 1.15; }
    .capa .linha { width: 70px; height: 4px; background: #CC0000; margin: 22px auto; border-radius: 2px; }
    .capa .desc { font-size: 12.5pt; color: #555; max-width: 118mm; margin: 0 auto; }
    .capa .rodape { margin-top: 52px; font-size: 9.5pt; color: #888; }

    /* ===== Sumário ===== */
    .sumario { page-break-after: always; }
    .sumario h2 { font-size: 17pt; color: #0A0A0A; border-bottom: 3px solid #CC0000;
                  padding-bottom: 7px; margin: 0 0 20px; }
    .sumario ol { list-style: none; padding: 0; margin: 0; }
    .sumario li { padding: 9px 0; border-bottom: 1px dotted #ccc; font-size: 12pt; }
    .sumario .n { display: inline-block; width: 26px; height: 26px; line-height: 26px;
                  background: #CC0000; color: #fff; border-radius: 50%; text-align: center;
                  font-size: 10pt; font-weight: bold; margin-right: 12px; }

    /* ===== Capítulos ===== */
    .cap { page-break-before: always; }
    .cap h2 { font-size: 16pt; color: #0A0A0A; margin: 0 0 14px;
              border-bottom: 3px solid #CC0000; padding-bottom: 7px; }
    .cap h2 .num { display: inline-block; width: 26px; height: 26px; line-height: 26px;
                   background: #CC0000; color: #fff; border-radius: 50%; text-align: center;
                   font-size: 10pt; margin-right: 9px; vertical-align: 2px; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 12px; padding-left: 22px; }
    li { margin-bottom: 6px; }
    ol li::marker { font-weight: bold; color: #CC0000; }

    .box { padding: 10px 13px; border-radius: 6px; margin: 12px 0; font-size: 11pt;
           page-break-inside: avoid; }
    .box .rot { display: block; font-weight: bold; font-size: 9pt; text-transform: uppercase;
                letter-spacing: 0.7px; margin-bottom: 3px; }
    .atencao { background: #FFF4F4; border-left: 4px solid #CC0000; }
    .atencao .rot { color: #CC0000; }
    .dica { background: #F2F8FF; border-left: 4px solid #1F6FEB; }
    .dica .rot { color: #1F6FEB; }

    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5pt;
            page-break-inside: avoid; }
    th { background: #0A0A0A; color: #fff; text-align: left; padding: 7px 10px; font-size: 10pt; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    td.primeira { font-weight: 600; white-space: nowrap; }
    tr:nth-child(even) td { background: #fafafa; }

    .fim { margin-top: 26px; padding-top: 12px; border-top: 2px solid #CC0000;
           font-size: 10pt; color: #666; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="capa">
    <div>
      <div class="marca"><img src="${LOGO}" alt="SOS Energia"></div>
      <div class="sub">${esc(EMPRESA.nomeFantasia)}</div>
    </div>
    <h1>Playbook do<br>Almoxarifado</h1>
    <div class="linha"></div>
    <p class="desc">
      Guia rápido do sistema para o dia a dia. Como lançar saída, devolver material,
      colher assinatura e resolver o que costuma travar.
    </p>
    <div class="rodape">
      Versão ${VERSAO} &nbsp;·&nbsp; Impresso em ${hoje}<br>
      ${esc(EMPRESA.razaoSocial)} &nbsp;·&nbsp; ${esc(EMPRESA.cidade)}
    </div>
  </div>

  <div class="sumario">
    <h2>O que tem neste guia</h2>
    <ol>${sumario}</ol>
  </div>

  ${capitulos}

  <div class="fim">
    <strong>Dúvida que não está aqui?</strong> Pergunte ao Agente IA pelo botão vermelho
    dentro do sistema — ele responde na hora e não altera nada sem a sua confirmação.
    Se ainda assim ficar em dúvida, fale com o João.
  </div>
</body>
</html>`

  const anterior = document.getElementById('playbook-print-frame')
  if (anterior) anterior.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'playbook-print-frame'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.onload = () => {
    // Espera o logo decodificar antes de imprimir — sem isso a capa sai sem a
    // marca (mesmo cuidado do relatório de uso interno com as fotos).
    const doc = iframe.contentDocument
    const img = doc?.querySelector('.capa img')
    const pronto = img?.decode ? img.decode().catch(() => {}) : Promise.resolve()
    pronto.then(() => {
      setTimeout(() => {
        imprimirComNome(iframe.contentWindow, 'Playbook do Almoxarifado - SOS Energia')
        setTimeout(() => iframe.remove(), 60000)
      }, 200)
    })
  }
  document.body.appendChild(iframe)
  iframe.srcdoc = html
}
