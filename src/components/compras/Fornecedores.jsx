import { useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useFirestore'
import NovoFornecedorModal from './NovoFornecedorModal'

export default function Fornecedores() {
  const { dados: fornecedores, carregando } = useCollection('fornecedores')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [busca, setBusca] = useState('')

  const filtrados = fornecedores
    .filter(f => f.ativo !== false)
    .filter(f => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return f.nome?.toLowerCase().includes(q) || f.produtos?.toLowerCase().includes(q)
    })
    .sort((a, b) => a.nome?.localeCompare(b.nome))

  async function desativar(id) {
    if (!window.confirm('Remover este fornecedor?')) return
    await updateDoc(doc(db, 'fornecedores', id), { ativo: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="input flex-1"
          placeholder="Buscar fornecedor ou produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <button
          onClick={() => { setEditando(null); setModalAberto(true) }}
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo fornecedor
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400 text-sm">Nenhum fornecedor cadastrado.</p>
          <button onClick={() => setModalAberto(true)} className="text-brand-red text-sm font-medium mt-2 hover:underline">
            Adicionar primeiro fornecedor
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(f => (
            <div key={f.id} className="card flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-600">{(f.nome || '?')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-black text-sm">{f.nome}</p>
                {f.responsavel && <p className="text-xs text-gray-500">Responsável: {f.responsavel}</p>}
                {f.produtos && <p className="text-xs text-gray-400 truncate mt-0.5">{f.produtos}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {f.telefone && (
                  <a
                    href={`https://wa.me/55${f.telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => { setEditando(f); setModalAberto(true) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => desativar(f.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <NovoFornecedorModal
          fornecedor={editando}
          onFechar={() => { setModalAberto(false); setEditando(null) }}
        />
      )}
    </div>
  )
}
