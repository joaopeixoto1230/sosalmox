import AgenteChat from './AgenteChat'

export default function AgenteIA() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-black">Chat SOS</h1>
        <p className="text-gray-500 text-sm mt-1">Assistente treinado com a base de conhecimento da SOS Energia.</p>
      </div>
      <div className="card p-5">
        <AgenteChat />
      </div>
    </div>
  )
}
