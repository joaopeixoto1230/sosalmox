import { useState, useRef, useEffect } from 'react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function parseLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatBR(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', className = '', min, max }) {
  const hoje = new Date()
  const selecionada = parseLocal(value)
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState(selecionada ? selecionada.getMonth() : hoje.getMonth())
  const [ano, setAno] = useState(selecionada ? selecionada.getFullYear() : hoje.getFullYear())
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function abrir() {
    if (selecionada) { setMes(selecionada.getMonth()); setAno(selecionada.getFullYear()) }
    setAberto(true)
  }

  function mesAnterior() {
    if (mes === 0) { setMes(11); setAno(a => a - 1) }
    else setMes(m => m - 1)
  }

  function proximoMes() {
    if (mes === 11) { setMes(0); setAno(a => a + 1) }
    else setMes(m => m + 1)
  }

  function selecionar(date) {
    onChange(toYMD(date))
    setAberto(false)
  }

  function limpar(e) {
    e.stopPropagation()
    onChange('')
  }

  function getDias() {
    const primeiro = new Date(ano, mes, 1)
    const ultimo = new Date(ano, mes + 1, 0)
    const dias = []

    // dias do mês anterior
    for (let i = 0; i < primeiro.getDay(); i++) {
      const d = new Date(ano, mes, -primeiro.getDay() + i + 1)
      dias.push({ date: d, atual: false })
    }
    // dias do mês atual
    for (let i = 1; i <= ultimo.getDate(); i++) {
      dias.push({ date: new Date(ano, mes, i), atual: true })
    }
    // dias do próximo mês para completar grid
    const restante = 42 - dias.length
    for (let i = 1; i <= restante; i++) {
      dias.push({ date: new Date(ano, mes + 1, i), atual: false })
    }
    return dias
  }

  const minDate = min ? parseLocal(min) : null
  const maxDate = max ? parseLocal(max) : null

  function desabilitado(date) {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const dias = getDias()

  return (
    <div ref={ref} className="relative">
      <div
        onClick={abrir}
        className={`input flex items-center cursor-pointer select-none ${className}`}
      >
        <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value ? 'text-brand-black flex-1' : 'text-gray-400 flex-1'}>
          {value ? formatBR(value) : placeholder}
        </span>
        {value && (
          <button onClick={limpar} className="text-gray-300 hover:text-gray-500 ml-1 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {aberto && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={mesAnterior}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-brand-black text-sm">
              {MESES[mes]} {ano}
            </span>
            <button onClick={proximoMes}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Dias */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {dias.map(({ date, atual }, i) => {
              const ymd = toYMD(date)
              const isHoje = toYMD(hoje) === ymd
              const isSel = value === ymd
              const isDis = desabilitado(date)
              return (
                <button
                  key={i}
                  onClick={() => !isDis && selecionar(date)}
                  disabled={isDis}
                  className={`
                    h-8 w-full rounded-xl text-xs font-medium transition-colors
                    ${isDis ? 'text-gray-200 cursor-default' : ''}
                    ${!isDis && !atual ? 'text-gray-300 hover:bg-gray-50' : ''}
                    ${!isDis && atual && !isSel && !isHoje ? 'text-gray-700 hover:bg-brand-red/10 hover:text-brand-red' : ''}
                    ${isHoje && !isSel ? 'text-brand-red font-bold ring-1 ring-brand-red/40 bg-red-50' : ''}
                    ${isSel ? 'bg-brand-red text-white font-bold shadow-sm' : ''}
                  `}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => { onChange(''); setAberto(false) }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Limpar
            </button>
            <button onClick={() => selecionar(hoje)}
              className="text-xs text-brand-red font-semibold hover:text-red-700 transition-colors">
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
