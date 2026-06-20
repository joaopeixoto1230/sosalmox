import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AgenteFlutuante from '../agente/AgenteFlutuante'

export default function MainLayout() {
  const [sidebarAberta, setSidebarAberta] = useState(false)

  return (
    <div className="flex h-dvh bg-brand-bg overflow-hidden">
      <Sidebar aberto={sidebarAberta} onFechar={() => setSidebarAberta(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onAbrirMenu={() => setSidebarAberta(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <AgenteFlutuante />
    </div>
  )
}
