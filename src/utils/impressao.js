// Nome do arquivo ao "Salvar como PDF".
//
// O navegador NÃO usa o <title> do documento que está dentro do iframe: ele usa
// o title da PÁGINA que disparou a impressão. Por isso todo relatório saía
// sugerido como "SOS Almoxarifado" e o João tinha que renomear na mão.
// A saída é trocar o document.title só durante a impressão e devolver depois —
// senão a aba fica com o nome do relatório para sempre.

// Barra, dois-pontos e companhia quebram o nome no macOS e no Windows.
const INVALIDOS = /[\\/:*?"<>|]+/g

/** Junta as partes com " - ", descartando as vazias, e limpa o que o sistema não aceita. */
export function nomeArquivo(...partes) {
  return partes
    .map(p => String(p ?? '').trim())
    .filter(Boolean)
    .join(' - ')
    .replace(INVALIDOS, '-')
    .replace(/\s+/g, ' ')
    // sem traço solto na ponta quando o equipamento vem vazio
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
}

/**
 * Imprime `janela` (contentWindow de um iframe ou window aberta) sugerindo `nome`
 * como nome do arquivo.
 */
export function imprimirComNome(janela, nome) {
  const anterior = document.title
  const sugerido = nomeArquivo(nome)
  if (sugerido) document.title = sugerido

  let timer = 0
  let devolvido = false

  function devolver() {
    if (devolvido) return
    devolvido = true
    document.title = anterior
    clearTimeout(timer)
    window.removeEventListener('afterprint', devolver)
    try { janela.removeEventListener('afterprint', devolver) } catch { /* janela pode já ter sumido */ }
  }

  // O afterprint chega quando o diálogo fecha. O timer é a rede de segurança
  // para o navegador que não dispara o evento.
  timer = setTimeout(devolver, 120000)
  window.addEventListener('afterprint', devolver)
  try { janela.addEventListener('afterprint', devolver) } catch { /* ignore */ }

  try {
    janela.focus()
    janela.print()
  } catch {
    devolver()
  }
}
