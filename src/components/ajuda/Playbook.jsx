import { useState } from 'react'
import { SECOES, VERSAO } from './conteudoPlaybook'
import { imprimirPlaybook } from './playbookImpresso'

// Playbook do Almoxarifado: o guia do sistema para a equipe.
//
// Vive DENTRO do sistema (e não como PDF solto) por dois motivos: a equipe
// consulta pelo celular na hora da dúvida, e o conteúdo acompanha as mudanças
// do sistema em vez de envelhecer numa gaveta. O botão Imprimir gera a versão
// em papel, com capa e sumário, a partir do mesmo texto.

function Bloco({ b }) {
  if (b.p) return <p className="text-sm text-gray-700 leading-relaxed">{b.p}</p>

  if (b.lista) {
    return (
      <ul className="space-y-1.5">
        {b.lista.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0 mt-[7px]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (b.passos) {
    return (
      <ol className="space-y-2">
        {b.passos.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
            <span className="w-6 h-6 rounded-full bg-brand-red text-white text-xs font-bold
              flex items-center justify-center flex-shrink-0 mt-px">
              {i + 1}
            </span>
            <span className="pt-0.5">{item}</span>
          </li>
        ))}
      </ol>
    )
  }

  if (b.atencao) {
    return (
      <div className="rounded-xl border-l-4 border-brand-red bg-red-50 px-3 py-2.5
        dark:bg-red-950/30">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-red mb-0.5">Atenção</p>
        <p className="text-sm text-gray-700 leading-relaxed">{b.atencao}</p>
      </div>
    )
  }

  if (b.dica) {
    return (
      <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 px-3 py-2.5
        dark:bg-blue-950/30">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-0.5">Dica</p>
        <p className="text-sm text-gray-700 leading-relaxed">{b.dica}</p>
      </div>
    )
  }

  if (b.tabela) {
    // No celular a tabela vira lista: tabela de 2 colunas em 360px espreme o
    // texto a ponto de uma palavra por linha.
    return (
      <div className="space-y-2 sm:space-y-0">
        <div className="sm:hidden space-y-2">
          {b.tabela.linhas.map((linha, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">
              <p className="text-sm font-semibold text-brand-black">{linha[0]}</p>
              <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{linha[1]}</p>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-black text-white">
                {b.tabela.cabecalho.map((c, i) => (
                  <th key={i} className="text-left font-semibold px-3 py-2 first:rounded-tl-lg last:rounded-tr-lg">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.tabela.linhas.map((linha, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  {linha.map((c, j) => (
                    <td key={j} className={`px-3 py-2 align-top ${
                      j === 0 ? 'font-semibold text-brand-black whitespace-nowrap' : 'text-gray-600'
                    }`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return null
}

export default function Playbook() {
  // No celular, tudo aberto viraria uma rolagem sem fim: abre uma seção por vez.
  // No desktop o comportamento é o mesmo, para o índice ficar sempre à vista.
  const [aberta, setAberta] = useState(SECOES[0]?.id || null)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Playbook do Almoxarifado</h1>
          <p className="text-gray-500 text-sm mt-1">
            Guia do sistema para o dia a dia. Toque num assunto para abrir.
          </p>
        </div>
        <button onClick={imprimirPlaybook} className="btn-secondary text-sm flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      <div className="space-y-2">
        {SECOES.map((secao, i) => {
          const ativa = aberta === secao.id
          return (
            <div
              key={secao.id}
              className={`card p-0 overflow-hidden transition-shadow ${ativa ? 'shadow-md' : ''}`}
            >
              <button
                onClick={() => setAberta(ativa ? null : secao.id)}
                aria-expanded={ativa}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left
                  hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center
                  justify-center flex-shrink-0 ${
                  ativa ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-semibold text-brand-black">{secao.titulo}</span>
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform
                  ${ativa ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {ativa && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-800">
                  {secao.blocos.map((b, j) => <Bloco key={j} b={b} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card bg-gray-50 dark:bg-gray-800/40">
        <p className="text-sm text-gray-700">
          <strong className="text-brand-black">Dúvida que não está aqui?</strong> Pergunte ao
          Agente IA pelo botão vermelho — ele responde na hora e não altera nada sem a sua
          confirmação. Se ainda assim ficar em dúvida, fale com o João.
        </p>
        <p className="text-xs text-gray-400 mt-2">Playbook versão {VERSAO}</p>
      </div>
    </div>
  )
}
