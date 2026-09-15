import { EMPRESA, empresaConfigurada } from './empresa'
import { imprimirComNome, nomeArquivo } from './impressao'
import { resumoConferencia, TIPOS_TERMO } from '../components/locacao/termos'

// Documento do termo de ENTREGA / DEVOLUÇÃO da locação — o papel que vai ao
// cliente. Sai do mesmo doc de `termos_locacao` que o link público preencheu,
// então o que está aqui é exatamente o que as duas partes assinaram.
//
// Mesma diagramação da Declaração de Sublocação (timbre, cláusula, duas
// assinaturas), com duas diferenças na devolução: a lista sai conferida item a
// item e o que faltou aparece em destaque, com as fotos anexadas.

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

function porExtenso(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-').map(Number)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  if (!meses[m - 1]) return ''
  return `${d} de ${meses[m - 1]} de ${a}`
}

function dataDoTermo(termo) {
  const ts = termo?.assinadoEm?.toDate?.() || termo?.criadoEm?.toDate?.() || new Date()
  return ts.toLocaleDateString('pt-BR')
}

function linhaItem(item, marca) {
  const qtd = Number(item.quantidade) > 0 ? Number(item.quantidade) : 1
  return `<li class="${marca || ''}">
    <strong>${qtd} ${qtd === 1 ? 'unidade' : 'unidades'}</strong> — ${esc((item.nome || '').toUpperCase())}
    ${item.categoria ? `<span class="cat">(${esc(item.categoria)})</span>` : ''}
    ${marca === 'faltou' ? '<span class="tag">NÃO DEVOLVIDO</span>' : ''}
    ${item.codigo ? `<div class="cods">Código: ${esc(item.codigo)}</div>` : ''}
  </li>`
}

/**
 * @param termo  doc de `termos_locacao` (com o id)
 * @param fotos  docs de `fotos_termo` daquele termo (opcional)
 */
export function gerarTermoLocacao(termo, fotos = []) {
  if (!termo) return
  if (!empresaConfigurada()) {
    window.alert(
      'Falta cadastrar os dados da SOS (razão social, CNPJ e endereço) para emitir o termo.\n\n'
      + 'Peça para preencher em src/utils/empresa.js.',
    )
    return
  }

  const ehDevolucao = termo.tipo === 'devolucao'
  const rotulos = TIPOS_TERMO[termo.tipo] || TIPOS_TERMO.entrega
  const itens = termo.itens || []
  const geradores = termo.geradores || []
  const { devolvidos, faltantes } = resumoConferencia(itens, termo.conferencia || {})

  const listaGeradores = geradores.map(g =>
    `<li><strong>1 unidade</strong> — GERADOR ${esc(g.codigo)}</li>`).join('')

  const lista = ehDevolucao
    ? [...listaGeradores, ...devolvidos.map(i => linhaItem(i))].join('')
    : [...listaGeradores, ...itens.map(i => linhaItem(i))].join('')

  const blocoFaltantes = ehDevolucao && faltantes.length > 0 ? `
    <div class="faltou-bloco">
      <p class="faltou-titulo">Material NÃO devolvido (${faltantes.length})</p>
      <ul class="itens">${faltantes.map(i => linhaItem(i, 'faltou')).join('')}</ul>
    </div>` : ''

  const blocoFotos = (fotos || []).length > 0 ? `
    <div class="fotos">
      <p class="secao">Fotos da conferência (${fotos.length})</p>
      <div class="grade">
        ${fotos.map(f => `<img src="${f.dataUrl}" alt="Foto da conferência"/>`).join('')}
      </div>
    </div>` : ''

  const corpo = ehDevolucao
    ? `<p>
        A empresa <strong>${esc(EMPRESA.razaoSocial)}</strong>, inscrita no CNPJ sob o nº
        ${esc(EMPRESA.cnpj)}, <strong>recolheu</strong> de
        <strong>${esc(termo.eventoNome || '')}</strong>${termo.local ? `, em ${esc(termo.local)}` : ''},
        pelas mãos de <strong>${esc(termo.clienteNome || '')}</strong>
        ${termo.clienteDocumento ? ` (RG ${esc(termo.clienteDocumento)})` : ''},
        o material abaixo relacionado, conferido item a item no ato da retirada:
      </p>`
    : `<p>
        A empresa <strong>${esc(EMPRESA.razaoSocial)}</strong>${EMPRESA.nomeFantasia ? ` (${esc(EMPRESA.nomeFantasia)})` : ''},
        inscrita no CNPJ sob o nº ${esc(EMPRESA.cnpj)}, <strong>entregou</strong> a
        <strong>${esc(termo.eventoNome || '')}</strong>${termo.local ? `, em ${esc(termo.local)}` : ''},
        sob a responsabilidade de <strong>${esc(termo.clienteNome || '')}</strong>
        ${termo.clienteDocumento ? ` (CPF ${esc(termo.clienteDocumento)})` : ''},
        o seguinte material, que permanecerá sob a guarda do recebedor até o recolhimento:
      </p>`

  const clausula = ehDevolucao
    ? (faltantes.length > 0
      ? `Conferido no ato da retirada. O material listado como NÃO DEVOLVIDO não foi
         apresentado no recolhimento e será cobrado pelo valor atual de mercado.`
      : `Conferido no ato da retirada. Todo o material relacionado foi devolvido.`)
    : `Todo material está em perfeito estado de conservação e permanece sob a
       responsabilidade do recebedor até a devolução. Caso ocorra extravio ou dano,
       será cobrado o valor atual de mercado.`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(rotulos.titulo)} — ${esc(termo.eventoNome || '')}</title>
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

    .secao { font-size: 11.5px; text-transform: uppercase; letter-spacing: .6px; color: #777;
             font-weight: bold; margin: 22px 0 6px; }

    ul.itens { margin: 12px 0 20px 4px; padding-left: 20px; }
    ul.itens li { margin-bottom: 9px; }
    ul.itens .cat { color: #666; font-weight: normal; }
    ul.itens .cods { font-size: 11.5px; color: #777; margin-top: 1px; }
    ul.itens li.faltou { color: #A30000; }
    .tag { display: inline-block; background: #CC0000; color: #fff; font-size: 10px; font-weight: bold;
           padding: 1px 6px; border-radius: 3px; margin-left: 6px; vertical-align: 1px; }

    .faltou-bloco { border: 1px solid #F0C0C0; background: #FFF6F6; border-left: 4px solid #CC0000;
                    padding: 10px 14px 2px; margin: 20px 0; page-break-inside: avoid; }
    .faltou-titulo { color: #A30000; font-weight: bold; font-size: 12.5px; text-transform: uppercase;
                     letter-spacing: .4px; margin: 0; }

    .obs { margin: 18px 0; padding: 10px 14px; background: #FAFAFA; border: 1px solid #E5E5E5; }
    .obs .secao { margin-top: 0; }

    .clausula { margin: 26px 0; padding: 12px 14px; border: 1px solid #E0E0E0; border-left: 4px solid #CC0000;
                background: #FBFBFB; text-transform: uppercase; font-size: 12.5px; font-weight: bold; line-height: 1.6; }

    .fotos { margin: 22px 0; page-break-inside: avoid; }
    .fotos .grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .fotos img { width: 100%; height: 52mm; object-fit: cover; border: 1px solid #DDD; border-radius: 3px; }

    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 46px; margin-top: 44px;
                   page-break-inside: avoid; break-inside: avoid; }
    .bloco { text-align: center; }
    .bloco img { display: block; margin: 0 auto -6px; height: 52px; object-fit: contain; }
    .linha { border-top: 1px solid #333; padding-top: 6px; margin-top: 40px; }
    .bloco img + .linha { margin-top: 0; }
    .bloco .quem { font-weight: bold; font-size: 13px; }
    .bloco .papel { font-size: 11.5px; color: #666; }
    .bloco .doc { font-size: 11.5px; color: #666; }

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

  <p class="data">${esc(EMPRESA.cidade)}, ${porExtenso(termo.dataEvento) || dataDoTermo(termo)}.</p>

  <h1>${esc(rotulos.titulo)} de Material</h1>

  <div class="corpo">
    ${corpo}
    <p class="secao">${ehDevolucao ? `Material devolvido (${devolvidos.length + geradores.length})` : `Material entregue (${itens.length + geradores.length})`}</p>
    <ul class="itens">${lista || '<li>Nenhum item registrado.</li>'}</ul>
    ${blocoFaltantes}
  </div>

  ${termo.observacoes ? `<div class="obs"><p class="secao">Observações</p>${esc(termo.observacoes)}</div>` : ''}

  <div class="clausula">${clausula}</div>

  ${blocoFotos}

  <div class="assinaturas">
    <div class="bloco">
      ${termo.sosAssinatura ? `<img src="${termo.sosAssinatura}"/>` : ''}
      <div class="linha">
        <div class="quem">${esc(termo.sosNome || '')}</div>
        <div class="papel">${esc(EMPRESA.razaoSocial)} — ${ehDevolucao ? 'quem recolheu' : 'quem entregou'}</div>
      </div>
    </div>
    <div class="bloco">
      ${termo.clienteAssinatura ? `<img src="${termo.clienteAssinatura}"/>` : ''}
      <div class="linha">
        <div class="quem">${esc(termo.clienteNome || '')}</div>
        ${termo.clienteDocumento ? `<div class="doc">${ehDevolucao ? 'RG' : 'CPF'} ${esc(termo.clienteDocumento)}</div>` : ''}
        <div class="papel">${esc(termo.eventoNome || '')} — ${ehDevolucao ? 'quem devolveu' : 'quem recebeu'}</div>
      </div>
    </div>
  </div>

  <div class="rodape">
    <span>${termo.numeroFormatado ? `Ordem de material ${esc(termo.numeroFormatado)}` : 'SOS Energia — Almoxarifado'}</span>
    <span>Emitido em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`

  const anterior = document.getElementById('termo-locacao-frame')
  if (anterior) anterior.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'termo-locacao-frame'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.onload = () => {
    const janela = iframe.contentWindow
    // Espera logo, assinaturas e fotos decodificarem: sem isso saem em branco
    // no PDF (mesmo cuidado dos outros relatórios do sistema).
    const imgs = [...janela.document.images]
    Promise.all(imgs.map(i => i.decode().catch(() => {}))).then(() => {
      imprimirComNome(janela, nomeArquivo(rotulos.titulo, termo.eventoNome))
      setTimeout(() => iframe.remove(), 60000)
    })
  }
  document.body.appendChild(iframe)
  iframe.srcdoc = html
}
