import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ tema: 'light', alternarTema: () => {} })

function aplicarTema(tema) {
  const root = document.documentElement
  if (tema === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'light')

  useEffect(() => {
    aplicarTema(tema)
    localStorage.setItem('tema', tema)
  }, [tema])

  function alternarTema() {
    setTema(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
