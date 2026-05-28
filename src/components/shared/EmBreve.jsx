export default function EmBreve({ titulo, descricao, fase = '2' }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card text-center py-16">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-black">{titulo}</h1>
        <p className="text-gray-500 mt-2 max-w-sm mx-auto">{descricao || `Este módulo será disponibilizado na Fase ${fase} do desenvolvimento.`}</p>
        <span className="inline-block mt-4 badge bg-yellow-100 text-yellow-700 text-sm px-3 py-1">
          Em desenvolvimento — Fase {fase}
        </span>
      </div>
    </div>
  )
}
