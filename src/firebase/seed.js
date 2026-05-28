import { db } from './config'
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'

const eventos = [
  { id: 'evt001', nome: 'Festival Recife 2026', data: '2026-06-15', local: 'Marco Zero, Recife/PE', status: 'ativo', operador: 'Valdemir' },
  { id: 'evt002', nome: 'Congresso Médico Nacional', data: '2026-06-20', local: 'Centro de Convenções, SP', status: 'ativo', operador: 'Sidney' },
  { id: 'evt003', nome: 'Show Forró Festival', data: '2026-07-05', local: 'Parque da Cidade, Natal/RN', status: 'agendado', operador: 'Valdemir' },
  { id: 'evt004', nome: 'Feira Agropecuária BA', data: '2026-07-12', local: 'Centro de Exposições, Salvador/BA', status: 'agendado', operador: 'Sidney' },
  { id: 'evt005', nome: 'Carnaval Olinda', data: '2026-02-20', local: 'Sítio Histórico, Olinda/PE', status: 'encerrado', operador: 'Valdemir' },
  { id: 'evt006', nome: 'Inauguração Shopping Norte', data: '2026-06-28', local: 'Shopping Norte, Fortaleza/CE', status: 'ativo', operador: 'Sidney' },
  { id: 'evt007', nome: 'Semana do Trabalhador', data: '2026-05-01', local: 'Praça Central, Campina Grande/PB', status: 'encerrado', operador: 'Valdemir' },
  { id: 'evt008', nome: 'Rock in Nordeste', data: '2026-08-10', local: 'Aeródromo, Caruaru/PE', status: 'agendado', operador: 'Sidney' },
  { id: 'evt009', nome: 'Expo Energia 2026', data: '2026-09-15', local: 'Pavilhão Industrial, Recife/PE', status: 'agendado', operador: 'Valdemir' },
  { id: 'evt010', nome: 'São João de Caruaru', data: '2026-06-24', local: 'Pátio de Eventos, Caruaru/PE', status: 'ativo', operador: 'Sidney' },
]

const geradores = [
  { id: 'gg001', codigo: 'GG-001', potencia: '275 kVA', marca: 'Stemac', modelo: 'ST-275', ano: 2018, status: 'disponivel', eventoAtual: null, horimetro: 3420, ultimaManutencao: '2026-05-10' },
  { id: 'gg002', codigo: 'GG-002', potencia: '150 kVA', marca: 'Stemac', modelo: 'ST-150', ano: 2020, status: 'em_evento', eventoAtual: 'evt001', horimetro: 1850, ultimaManutencao: '2026-04-22' },
  { id: 'gg003', codigo: 'GG-003', potencia: '500 kVA', marca: 'Cummins', modelo: 'C500D5', ano: 2019, status: 'manutencao', eventoAtual: null, horimetro: 5100, ultimaManutencao: '2026-05-20' },
  { id: 'gg004', codigo: 'GG-004', potencia: '110 kVA', marca: 'Perkins', modelo: '1100A', ano: 2021, status: 'disponivel', eventoAtual: null, horimetro: 920, ultimaManutencao: '2026-05-18' },
  { id: 'gg005', codigo: 'GG-005', potencia: '350 kVA', marca: 'Caterpillar', modelo: 'C15', ano: 2017, status: 'disponivel', eventoAtual: null, horimetro: 6700, ultimaManutencao: '2026-05-01' },
]

const categorias = [
  { id: 'cabo4x', nome: 'Cabos 4x', subcategoria: 'cabo_unico' },
  { id: 'caboterra', nome: 'Cabos Terra', subcategoria: 'cabo_unico' },
  { id: 'jogocabo', nome: 'Jogos de Cabo', subcategoria: 'jogo_3f' },
  { id: 'rabicho', nome: 'Rabichos', subcategoria: 'jogo_curto' },
  { id: 'outros', nome: 'Outros Materiais', subcategoria: 'geral' },
]

const buildMateriais = () => {
  const items = []

  const cabo4x = [
    { bitola: '4x6', metragem: '25m' },
    { bitola: '4x10', metragem: '30m' },
    { bitola: '4x16', metragem: '50m' },
    { bitola: '4x25', metragem: '50m' },
    { bitola: '4x35', metragem: '50m' },
    { bitola: '4x50', metragem: '50m' },
  ]
  cabo4x.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_c4x_${c.bitola.replace('x', '')}${num}`,
      nome: `${c.bitola}/${num}/${c.metragem}`,
      codigo: `CAB-4X-${c.bitola.replace('x', '')}-${num}`,
      categoria: 'Cabos 4x',
      subcategoria: 'cabo_unico',
      bitola: c.bitola,
      numero: parseInt(num),
      metragem: c.metragem,
      tipo: 'Cabo único',
      status: i % 3 === 1 ? 'em_evento' : 'disponivel',
      eventoAtual: i % 3 === 1 ? 'evt001' : null,
      estoqueMin: 1,
      estoqueAtual: i % 3 === 1 ? 0 : 1,
    })
  })

  const caboTerra = [
    { bitola: '1x10', metragem: '30m' },
    { bitola: '1x16', metragem: '30m' },
    { bitola: '70mm²', metragem: '50m' },
    { bitola: '95mm²', metragem: '50m' },
    { bitola: '120mm²', metragem: '50m' },
  ]
  caboTerra.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_ct_${i}`,
      nome: `Terra ${c.bitola}/${num}/${c.metragem}`,
      codigo: `CAB-T-${i + 1}`,
      categoria: 'Cabos Terra',
      subcategoria: 'cabo_unico',
      bitola: c.bitola,
      numero: parseInt(num),
      metragem: c.metragem,
      tipo: 'Cabo terra',
      status: 'disponivel',
      eventoAtual: null,
      estoqueMin: 1,
      estoqueAtual: 1,
    })
  })

  const bitolasJogo = ['70mm²', '95mm²', '120mm²', '150mm²', '185mm²', '240mm²']
  bitolasJogo.forEach((b, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_jc_${i}`,
      nome: `Jogo ${b}/${num}`,
      codigo: `JOG-${b.replace('²', '2')}-${num}`,
      categoria: 'Jogos de Cabo',
      subcategoria: 'jogo_3f',
      bitola: b,
      numero: parseInt(num),
      metragem: '50m',
      tipo: 'Jogo 3F+N',
      status: i % 4 === 0 ? 'em_evento' : 'disponivel',
      eventoAtual: i % 4 === 0 ? 'evt002' : null,
      estoqueMin: 1,
      estoqueAtual: i % 4 === 0 ? 0 : 1,
    })
  })

  const bitolasRab = ['70mm²', '95mm²', '120mm²', '150mm²', '185mm²', '240mm²']
  bitolasRab.forEach((b, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_rb_${i}`,
      nome: `Rabicho ${b}/${num}`,
      codigo: `RAB-${b.replace('²', '2')}-${num}`,
      categoria: 'Rabichos',
      subcategoria: 'jogo_curto',
      bitola: b,
      numero: parseInt(num),
      metragem: '10m',
      tipo: 'Rabicho 3F+N',
      status: 'disponivel',
      eventoAtual: null,
      estoqueMin: 1,
      estoqueAtual: 1,
    })
  })

  const outros = [
    { nome: 'Multi-pino 5P', codigo: 'MULT-5P-01', tipo: 'Conector' },
    { nome: 'Multi-pino 3P', codigo: 'MULT-3P-01', tipo: 'Conector' },
    { nome: 'Régua de distribuição', codigo: 'REG-DIST-01', tipo: 'Equipamento' },
    { nome: 'Barra de cobre 200A', codigo: 'BAR-200A-01', tipo: 'Equipamento' },
    { nome: 'Caixa de distribuição', codigo: 'CAI-DIST-01', tipo: 'Equipamento' },
    { nome: 'Mangueira combustível 10m', codigo: 'MANG-COMB-01', tipo: 'Acessório' },
    { nome: 'Kit bornes', codigo: 'KIT-BORNE-01', tipo: 'Acessório' },
  ]
  outros.forEach((o, i) => {
    items.push({
      id: `mat_ot_${i}`,
      nome: o.nome,
      codigo: o.codigo,
      categoria: 'Outros Materiais',
      subcategoria: 'geral',
      bitola: null,
      numero: null,
      metragem: null,
      tipo: o.tipo,
      status: 'disponivel',
      eventoAtual: null,
      estoqueMin: 2,
      estoqueAtual: Math.floor(Math.random() * 4) + 1,
    })
  })

  return items
}

export async function seedDatabase() {
  const batch = writeBatch(db)

  for (const evt of eventos) {
    const ref = doc(db, 'eventos', evt.id)
    batch.set(ref, { ...evt, criadoEm: serverTimestamp() })
  }

  for (const gg of geradores) {
    const ref = doc(db, 'geradores', gg.id)
    batch.set(ref, { ...gg, criadoEm: serverTimestamp() })
  }

  const materiais = buildMateriais()
  for (const mat of materiais) {
    const ref = doc(db, 'materiais', mat.id)
    batch.set(ref, { ...mat, criadoEm: serverTimestamp() })
  }

  const counterRef = doc(db, 'contadores', 'ordens_saida')
  batch.set(counterRef, { ultimo: 0 })

  await batch.commit()
  console.log('Seed concluído:', eventos.length, 'eventos,', geradores.length, 'geradores,', materiais.length, 'materiais')
  return { eventos: eventos.length, geradores: geradores.length, materiais: materiais.length }
}
