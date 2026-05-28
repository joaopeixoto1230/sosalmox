import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout() {
  const [sidebarAberta, setSidebarAberta] = useState(false)

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar
        aberto={sidebarAberta}
        onFechar={() => setSidebarAberta(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onAbrirMenu={() => setSidebarAberta(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <button
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-red text-white rounded-full shadow-lg hover:bg-brand-red-dark transition-all hover:scale-105 flex items-center justify-center z-50"
        title="Agente IA (em breve)"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
    </div>
  )
}
