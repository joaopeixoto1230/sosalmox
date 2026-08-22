import { describe, it, expect } from 'vitest'
import { pareceUsoInterno } from './sugestaoGrupo'
import { grupoDoMaterial } from './categorias'

// A modal de mover abre no sentido da aba em que o usuário estava. Abrindo pela
// aba Material Interno (vazia), a lista sai vazia — foi o que aconteceu com o
// João. Aqui fica travado o comportamento das duas direções.
const preMarcados = (lista, destino) =>
  new Set(destino === 'uso_interno' ? lista.filter(pareceUsoInterno).map(m => m.id) : [])

const daGrupo = (materiais, grupo) => materiais.filter(m => grupoDoMaterial(m) === grupo)

const acervo = [
  { id: 'a', nome: 'Fita isolante', categoria: 'Outros Materiais', tipo: 'Fita Isolante' },
  { id: 'b', nome: 'Cabo 35mm', categoria: 'Cabos 4x', tipo: 'Cabo único' },
  { id: 'c', nome: 'Parafuso 8mm', categoria: 'Outros Materiais', tipo: 'Parafuso' },
  { id: 'd', nome: 'Luva', grupo: 'uso_interno', categoria: 'EPI' },
]

describe('sentido da mudança de grupo', () => {
  it('de Materiais de Evento para Material Interno: marca fita e parafuso, nunca o cabo', () => {
    const candidatos = daGrupo(acervo, 'eventos')
    expect(candidatos.map(m => m.id)).toEqual(['a', 'b', 'c'])
    expect([...preMarcados(candidatos, 'uso_interno')]).toEqual(['a', 'c'])
  })

  it('no sentido inverso, nada vem marcado — trazer de volta é escolha manual', () => {
    const candidatos = daGrupo(acervo, 'uso_interno')
    expect(candidatos.map(m => m.id)).toEqual(['d'])
    expect([...preMarcados(candidatos, 'eventos')]).toEqual([])
  })

  it('grupo vazio devolve lista vazia — a tela precisa oferecer trocar o sentido', () => {
    const soEventos = acervo.filter(m => grupoDoMaterial(m) === 'eventos')
    expect(daGrupo(soEventos, 'uso_interno')).toEqual([])
  })
})
