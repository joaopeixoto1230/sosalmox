// Gráfico de rosca (donut) para composições do painel.
// A paleta fica em ./cores.js, com a nota sobre a verificação de daltonismo.
const CX = 100
const R_EXT = 82
const R_INT = 52
const R_MEIO = (R_EXT + R_INT) / 2
const RESPIRO = 2 / R_MEIO // 2px de folga entre fatias, medidos no raio médio

const ponto = (r, a) => [CX + r * Math.cos(a), CX + r * Math.sin(a)]

function anel(a0, a1) {
  const grande = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = ponto(R_EXT, a0)
  const [x1, y1] = ponto(R_EXT, a1)
  const [x2, y2] = ponto(R_INT, a1)
  const [x3, y3] = ponto(R_INT, a0)
  return `M${x0} ${y0} A${R_EXT} ${R_EXT} 0 ${grande} 1 ${x1} ${y1} `
    + `L${x2} ${y2} A${R_INT} ${R_INT} 0 ${grande} 0 ${x3} ${y3} Z`
}

/**
 * @param {{rotulo: string, valor: number, cor: string}[]} dados
 */
export default function Rosca({ titulo, subtitulo, unidade, dados, recado, to }) {
  const fatias = dados.filter(d => d.valor > 0)
  const total = fatias.reduce((s, d) => s + d.valor, 0)

  const corpo = (
    <div className="card h-full flex flex-col gap-3">
      <div>
        <p className="font-semibold text-sm text-brand-black">{titulo}</p>
        {subtitulo && <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>}
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-gray-400 text-center">Nada registrado no período.</p>
        </div>
      ) : (
        <>
          <svg viewBox="0 0 200 200" className="w-full max-w-[168px] mx-auto block" role="img"
            aria-label={`${titulo}: ${total} ${unidade}`}>
            {(() => {
              let ang = -Math.PI / 2
              return fatias.map(d => {
                const fracao = d.valor / total
                const arco = fracao * 2 * Math.PI
                const a0 = ang + RESPIRO / 2
                const a1 = Math.max(ang + arco - RESPIRO / 2, ang + RESPIRO / 2 + 0.004)
                ang += arco
                const pct = Math.round(fracao * 100)
                // Sem rótulo dentro da fatia: em fatia estreita o texto estoura
                // o anel, e a legenda logo abaixo já traz valor e percentual.
                return (
                  <path key={d.rotulo} d={anel(a0, a1)} fill={d.cor}>
                    <title>{`${d.rotulo}: ${d.valor} (${pct}%)`}</title>
                  </path>
                )
              })
            })()}
            {/* currentColor para o texto seguir o tema: os overrides do modo
                escuro agem sobre `text-`, não sobre `fill-`. */}
            <text x="100" y="95" textAnchor="middle" fontSize="34" fontWeight="800"
              fill="currentColor" className="text-brand-black">{total}</text>
            <text x="100" y="115" textAnchor="middle" fontSize="11"
              fill="currentColor" className="text-gray-400">{unidade}</text>
          </svg>

          <ul className="flex flex-col gap-1.5">
            {fatias.map(d => (
              <li key={d.rotulo} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.cor }} />
                <span className="flex-1 min-w-0 truncate">{d.rotulo}</span>
                <b className="text-brand-black tabular-nums">{d.valor}</b>
                <span className="w-9 text-right text-gray-400 tabular-nums">
                  {Math.round(d.valor / total * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {recado && (
        <p className="text-xs text-gray-400 leading-relaxed mt-auto pt-2.5 border-t border-gray-100">
          {recado}
        </p>
      )}
    </div>
  )

  return to ? <a href={to} className="block h-full">{corpo}</a> : corpo
}
