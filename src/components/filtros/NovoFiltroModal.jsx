import { useState } from 'react'
import { collection, doc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const TIPOS = ['Filtro de Combustível 1', 'Filtro de Combustível 2', 'Filtro Separador de Água', 'Filtro de Óleo 1', 'Filtro de Óleo 2', 'Filtro de Ar']
const POTENCIAS = ['30kVA', '40kVA', '60kVA', '75kVA', '100kVA', '125kVA', '150kVA', '180kVA', '200kVA', '250kVA', '300kVA', '350kVA', '400kVA', '500kVA', '700kVA', '750kVA', 'Caminhão', 'Empilhadeira']

export default function NovoFiltroModal({ onFechar }) {
  const { uid, nome } = useAuth()
  const [form, setForm] = useState({ potenciaGG: '', tipo: '', nome: '', referencia: '', fornecedor: '', estoqueMin: '1', unidade: 'un', quantidadeAtual: '0' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function salvar() {
    if (!form.potenciaGG || !form.tipo || !form.nome) { setErro('Preencha potência, tipo e nome.'); return }
    setSalvando(true); setErro('')
    try {
      const ref = doc(collection(db, 'filtros'))
      await runTransaction(db, async (tx) => {
        tx.set(ref, {
          potenciaGG: form.potenciaGG,
          tipo: form.tipo,
          nome: form.nome,
          referencia: form.referencia,
          fornecedor: form.fornecedor,
          estoqueMin: parseInt(form.estoqueMin) || 1,
          quantidadeAtual: parseInt(form.quantidadeAtual) || 0,
          unidade: form.unidade || 'un',
          ativo: true,
          criadoPor: uid,
          criadoPorNome: nome,
          criadoEm: serverTimestamp(),
        })
      })
      onFechar()
    } catch (e) {
      setErro(e.message || 'Erro ao cadastrar filtro.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md space-y-4 p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-brand-black">Novo Filtro</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Potência / Equipamento *</label>
            <select value={form.potenciaGG} onChange={e => set('potenciaGG', e.target.value)} className="input">
              <option value="">Selecionar...</option>
              {POTENCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Filtro *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input">
              <option value="">Selecionar...</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome / Descrição *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input" placeholder="Ex: Filtro combustível Cummins 6BT" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Referência</label>
            <input value={form.referencia} onChange={e => set('referencia', e.target.value)} className="input" placeholder="Ex: FS1006" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fornecedor</label>
            <input value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} className="input" placeholder="Nome do fornecedor" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qtd. atual</label>
              <input type="number" min="0" value={form.quantidadeAtual} onChange={e => set('quantidadeAtual', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mínimo</label>
              <input type="number" min="0" value={form.estoqueMin} onChange={e => set('estoqueMin', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unidade</label>
              <input value={form.unidade} onChange={e => set('unidade', e.target.value)} className="input" placeholder="un" />
            </div>
          </div>
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onFechar} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 justify-center">
            {salvando ? 'Salvando...' : 'Cadastrar Filtro'}
          </button>
        </div>
      </div>
    </div>
  )
}
