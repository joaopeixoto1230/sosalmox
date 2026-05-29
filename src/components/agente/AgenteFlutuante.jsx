import { useState } from 'react'
import AgenteChat from './AgenteChat'

export default function AgenteFlutuante() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setAberto(false)} />
      )}

      <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3`}>
        {aberto && (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[min(380px,calc(100vw-3rem))] flex flex-col overflow-hidden"
            style={{ height: 'min(520px, calc(100vh-120px))' }}>
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-brand-red text-white">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="font-semibold text-sm">Chat SOS</span>
              </div>
              <button onClick={() => setAberto(false)} className="text-white/80 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
              <AgenteChat compact={true} />
            </div>
          </div>
        )}

        <button
          onClick={() => setAberto(prev => !prev)}
          className={`w-14 h-14 bg-brand-red text-white rounded-full shadow-lg hover:bg-brand-red-dark transition-all hover:scale-105 flex items-center justify-center ${aberto ? 'scale-95' : ''}`}
          title="Agente IA"
        >
          {aberto ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
          )}
        </button>
      </div>
    </>
  )
}
