import { EMPRESA, empresaConfigurada } from './empresa'

// Declaração de Entrega de Material para SUBLOCAÇÃO — o papel que a outra
// empresa assina ao retirar o equipamento. Substitui o documento que era
// digitado à mão a cada saída.

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

function porExtenso(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-').map(Number)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${d} de ${meses[m - 1]} de ${a}`
}

// Junta os itens de todas as OS do evento e agrupa iguais, para o documento
// dizer "3 unidades — Cabo 4x50" em vez de repetir a linha três vezes.
function agruparItens(ordens, itemAtual = x => x) {
  const mapa = new Map()
  for (const o of ordens) {
    for (const bruto of (o.itens || [])) {
      const item = itemAtual(bruto)
      const chave = `${item.nome || ''}|${item.categoria || ''}`
      const qtd = Number(item.quantidade) > 0 ? Number(item.quantidade) : 1
      const atual = mapa.get(chave) || { nome: item.nome, categoria: item.categoria, codigos: [], qtd: 0 }
      atual.qtd += qtd
      if (item.codigo) atual.codigos.push(item.codigo)
      mapa.set(chave, atual)
    }
  }
  return [...mapa.values()]
}

function codigosGeradores(ordens) {
  const codigos = new Set()
  for (const o of ordens) {
    if (Array.isArray(o.geradores)) o.geradores.forEach(g => g.codigo && codigos.add(g.codigo))
    else if (o.geradorCodigo) codigos.add(o.geradorCodigo)
  }
  return [...codigos]
}

/**
 * @param evento    doc de `eventos` com tipo 'sublocacao'
 * @param ordens    ordens_saida daquele evento
 * @param assinatura doc de assinaturas_saida da primeira OS (opcional)
 * @param itemAtual função que resolve o item pelo cadastro atual (opcional)
 */
export function gerarDeclaracaoSublocacao(evento, ordens = [], assinatura = null, itemAtual) {
  if (!empresaConfigurada()) {
    window.alert(
      'Falta cadastrar os dados da SOS (razão social, CNPJ e endereço) para emitir a declaração.\n\n'
      + 'Peça para preencher em src/utils/empresa.js.',
    )
    return
  }

  const itens = agruparItens(ordens, itemAtual)
  const geradores = codigosGeradores(ordens)

  const linhas = [
    ...geradores.map(c => `<li><strong>1 unidade</strong> — GERADOR ${esc(c)}</li>`),
    ...itens.map(i => `<li><strong>${i.qtd} ${i.qtd === 1 ? 'unidade' : 'unidades'}</strong> — ${esc((i.nome || '').toUpperCase())}`
      + `${i.categoria ? ` <span class="cat">(${esc(i.categoria)})</span>` : ''}`
      + `${i.codigos.length ? `<div class="cods">Código: ${esc(i.codigos.join(', '))}</div>` : ''}</li>`),
  ].join('')

  const numero = ordens.map(o => o.numeroFormatado).filter(Boolean).join(', ')
  const recebeu = evento.retiradoPor || assinatura?.recebeuNome || ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Declaração de Entrega — ${esc(evento.nome)}</title>
  <style>
    @page { size: A4; margin: 18mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13.5px; line-height: 1.65; margin: 0; }

    .topo { display: flex; align-items: center; justify-content: space-between; gap: 20px;
            border-bottom: 3px solid #CC0000; padding-bottom: 12px; }
    .topo img { height: 46px; }
    .topo .dir { text-align: right; font-size: 11.5px; color: #666; line-height: 1.5; }
    .topo .dir b { color: #111; font-size: 13px; }

    .data { text-align: right; margin: 22px 0 26px; font-size: 13px; }

    h1 { font-size: 16px; text-align: center; text-decoration: underline; letter-spacing: .5px;
         margin: 0 0 26px; text-transform: uppercase; }

    .corpo { text-align: justify; }
    .corpo strong { font-weight: bold; }

    ul.itens { margin: 20px 0 20px 4px; padding-left: 20px; }
    ul.itens li { margin-bottom: 9px; }
    ul.itens .cat { color: #666; font-weight: normal; }
    ul.itens .cods { font-size: 11.5px; color: #777; margin-top: 1px; }

    .clausula { margin: 26px 0; padding: 12px 14px; border: 1px solid #E0E0E0; border-left: 4px solid #CC0000;
                background: #FBFBFB; text-transform: uppercase; font-size: 12.5px; font-weight: bold; line-height: 1.6; }

    .fecho { margin: 22px 0 34px; }

    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 46px; margin-top: 40px;
                   page-break-inside: avoid; break-inside: avoid; }
    .bloco { text-align: center; }
    .bloco img { display: block; margin: 0 auto -6px; height: 52px; object-fit: contain; }
    .linha { border-top: 1px solid #333; padding-top: 6px; margin-top: 40px; }
    .bloco img + .linha { margin-top: 0; }
    .bloco .quem { font-weight: bold; font-size: 13px; }
    .bloco .papel { font-size: 11.5px; color: #666; }
    .campo { margin-top: 26px; font-size: 13px; }
    .campo span { display: inline-block; border-bottom: 1px solid #999; min-width: 62%; }

    .rodape { margin-top: 34px; padding-top: 10px; border-top: 1px solid #E5E5E5;
              display: flex; justify-content: space-between; font-size: 10.5px; color: #999; }
  </style>
</head>
<body>
  <div class="topo">
    <img src="/logo-sos-v2.png" alt="SOS Energia"/>
    <div class="dir">
      <b>${esc(EMPRESA.razaoSocial)}</b><br/>
      CNPJ: ${esc(EMPRESA.cnpj)}
      ${EMPRESA.endereco ? `<br/>${esc(EMPRESA.endereco)}` : ''}
    </div>
  </div>

  <p class="data">${esc(EMPRESA.cidade)}, ${porExtenso(evento.data)}.</p>

  <h1>Declaração de Entrega de Material</h1>

  <div class="corpo">
    <p>
      A empresa <strong>${esc(EMPRESA.razaoSocial)}</strong>${EMPRESA.nomeFantasia ? ` (${esc(EMPRESA.nomeFantasia)})` : ''}${EMPRESA.endereco ? `, com sede na ${esc(EMPRESA.endereco)}` : ''},
      inscrita no CNPJ sob o nº ${esc(EMPRESA.cnpj)}, entregou a
      <strong>${esc(evento.nome)}</strong>${evento.empresaCnpj ? `, inscrita no CNPJ sob o nº ${esc(evento.empresaCnpj)}` : ''},
      sob a responsabilidade de <strong>${esc(recebeu)}</strong>${evento.retiradoDocumento ? ` (documento ${esc(evento.retiradoDocumento)})` : ''},
      o seguinte material:
    </p>

    <ul class="itens">
      ${linhas || '<li>Nenhum item registrado.</li>'}
    </ul>

    ${evento.local ? `<p><strong>Destino:</strong> ${esc(evento.local)}</p>` : ''}
    ${evento.retiradoTelefone ? `<p><strong>Contato:</strong> ${esc(evento.retiradoTelefone)}</p>` : ''}
  </div>

  <div class="clausula">
    Todo material está em perfeito estado de conservação. Caso ocorra extravio ou dano,
    será cobrado o valor atual de mercado.
  </div>

  <p class="fecho">Para maior clareza, firmo a presente Declaração.</p>

  <div class="assinaturas">
    <div class="bloco">
      ${assinatura?.entregouAssinatura ? `<img src="${assinatura.entregouAssinatura}"/>` : ''}
      <div class="linha">
        <div class="quem">${esc(assinatura?.entregouNome || '')}</div>
        <div class="papel">${esc(EMPRESA.razaoSocial)} — quem entregou</div>
      </div>
    </div>
    <div class="bloco">
      ${assinatura?.recebeuAssinatura ? `<img src="${assinatura.recebeuAssinatura}"/>` : ''}
      <div class="linha">
        <div class="quem">${esc(recebeu)}</div>
        <div class="papel">${esc(evento.nome)} — quem recebeu</div>
      </div>
    </div>
  </div>

  ${assinatura?.recebeuAssinatura ? '' : `
  <div class="campo"><strong>Nome por extenso:</strong> <span></span></div>
  <div class="campo"><strong>CPF:</strong> <span></span></div>`}

  <div class="rodape">
    <span>${numero ? `Ordem de material ${esc(numero)}` : 'SOS Energia — Almoxarifado'}</span>
    <span>Emitido em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`

  // imprime por iframe oculto, como os outros relatórios do sistema — abrir
  // aba nova travava o sistema ao voltar
  const anterior = document.getElementById('declaracao-frame')
  if (anterior) anterior.remove()
  const iframe = document.createElement('iframe')
  iframe.id = 'declaracao-frame'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.onload = () => {
    const janela = iframe.contentWindow
    // espera as imagens (logo e assinaturas) decodificarem: sem isso saem em
    // branco no PDF
    const imgs = [...janela.document.images]
    Promise.all(imgs.map(i => i.decode().catch(() => {})))
      .then(() => {
        try { janela.focus(); janela.print() } catch { /* ignore */ }
        setTimeout(() => iframe.remove(), 60000)
      })
  }
  document.body.appendChild(iframe)
  iframe.srcdoc = html
}
