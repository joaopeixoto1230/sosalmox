import { db } from './config'
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
  updateDoc,
  deleteDoc,
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

const MARCAS = ['Stemac', 'Cummins', 'Perkins', 'Caterpillar', 'Volvo', 'MWM', 'Scania']
const POTENCIAS = ['30kVA', '40kVA', '60kVA', '75kVA', '100kVA', '125kVA', '150kVA', '180kVA', '200kVA', '250kVA', '275kVA', '300kVA', '350kVA', '400kVA', '500kVA']
const STATUS_GG = ['disponivel', 'disponivel', 'disponivel', 'disponivel', 'em_evento', 'em_evento', 'manutencao', 'defeito']

const buildGeradores = () => {
  const lista = []
  for (let i = 1; i <= 107; i++) {
    const codigo = `GG-${String(i).padStart(3, '0')}`
    const potencia = POTENCIAS[i % POTENCIAS.length]
    const marca = MARCAS[i % MARCAS.length]
    const status = STATUS_GG[i % STATUS_GG.length]
    const temDefeito = status === 'defeito'
    lista.push({
      id: `gg${String(i).padStart(3, '0')}`,
      codigo,
      potencia,
      marca,
      modelo: `${marca.slice(0, 2).toUpperCase()}-${potencia.replace('kVA', '')}`,
      ano: 2015 + (i % 10),
      status: temDefeito ? 'defeito' : status,
      localizacao: status === 'em_evento' ? 'Evento externo' : status === 'manutencao' ? 'Em manutenção' : 'Pátio SOS',
      horimetroAtual: Math.floor(Math.random() * 8000) + 500,
      temDefeito,
      defeito: temDefeito ? 'Verificar sistema de arrefecimento' : '',
      eventoAtual: status === 'em_evento' ? 'evt001' : null,
      ativo: true,
    })
  }
  return lista
}

const buildFiltros = () => {
  const potencias = ['30kVA', '60kVA', '100kVA', '150kVA', '200kVA', '275kVA', '350kVA', '500kVA']
  const tipos = [
    { tipo: 'Filtro de Combustível 1', ref: 'FS1006', un: 'un' },
    { tipo: 'Filtro de Combustível 2', ref: 'FS1212', un: 'un' },
    { tipo: 'Filtro Separador de Água', ref: 'FS1232', un: 'un' },
    { tipo: 'Filtro de Óleo 1', ref: 'LF3349', un: 'un' },
    { tipo: 'Filtro de Óleo 2', ref: 'LF9009', un: 'un' },
    { tipo: 'Filtro de Ar', ref: 'AF25557', un: 'un' },
  ]
  const filtros = []
  let idx = 0
  for (const pot of potencias) {
    for (const t of tipos) {
      idx++
      const qtd = idx % 5 === 0 ? 0 : idx % 4 === 0 ? 1 : Math.floor(Math.random() * 6) + 2
      filtros.push({
        id: `flt_${pot.replace('kVA', '')}_${t.ref}`,
        potenciaGG: pot,
        tipo: t.tipo,
        nome: `${t.tipo} ${pot} — ${t.ref}`,
        referencia: t.ref,
        fornecedor: ['Cummins Distribuidora', 'Fleetguard', 'Mann Filter'][idx % 3],
        quantidadeAtual: qtd,
        estoqueMin: 2,
        unidade: t.un,
        ativo: true,
      })
    }
  }
  return filtros
}

const buildMateriais = () => {
  const items = []

  const cabo4x = [
    { bitola: '4x6', metragem: '25m' }, { bitola: '4x10', metragem: '30m' },
    { bitola: '4x16', metragem: '50m' }, { bitola: '4x25', metragem: '50m' },
    { bitola: '4x35', metragem: '50m' }, { bitola: '4x50', metragem: '50m' },
  ]
  cabo4x.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_c4x_${c.bitola.replace('x', '')}${num}`,
      nome: `${c.bitola}/${num}/${c.metragem}`,
      codigo: `CAB-4X-${c.bitola.replace('x', '')}-${num}`,
      categoria: 'Cabos 4x', subcategoria: 'cabo_unico',
      bitola: c.bitola, numero: parseInt(num), metragem: c.metragem, tipo: 'Cabo único',
      status: i % 3 === 1 ? 'em_evento' : 'disponivel',
      eventoAtual: i % 3 === 1 ? 'evt001' : null,
      estoqueMin: 1, estoqueAtual: i % 3 === 1 ? 0 : 1,
    })
  })

  const caboTerra = [
    { bitola: '1x10', metragem: '30m' }, { bitola: '1x16', metragem: '30m' },
    { bitola: '70mm²', metragem: '50m' }, { bitola: '95mm²', metragem: '50m' },
    { bitola: '120mm²', metragem: '50m' },
  ]
  caboTerra.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_ct_${i}`,
      nome: `Terra ${c.bitola}/${num}/${c.metragem}`,
      codigo: `CAB-T-${i + 1}`,
      categoria: 'Cabos Terra', subcategoria: 'cabo_unico',
      bitola: c.bitola, numero: parseInt(num), metragem: c.metragem, tipo: 'Cabo terra',
      status: 'disponivel', eventoAtual: null, estoqueMin: 1, estoqueAtual: 1,
    })
  })

  const bitolasJogo = ['70mm²', '95mm²', '120mm²', '150mm²', '185mm²', '240mm²']
  bitolasJogo.forEach((b, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_jc_${i}`,
      nome: `Jogo ${b}/${num}`, codigo: `JOG-${b.replace('²', '2')}-${num}`,
      categoria: 'Jogos de Cabo', subcategoria: 'jogo_3f',
      bitola: b, numero: parseInt(num), metragem: '50m', tipo: 'Jogo 3F+N',
      status: i % 4 === 0 ? 'em_evento' : 'disponivel',
      eventoAtual: i % 4 === 0 ? 'evt002' : null,
      estoqueMin: 1, estoqueAtual: i % 4 === 0 ? 0 : 1,
    })
  })

  const bitolasRab = ['70mm²', '95mm²', '120mm²', '150mm²', '185mm²', '240mm²']
  bitolasRab.forEach((b, i) => {
    const num = String(i + 1).padStart(2, '0')
    items.push({
      id: `mat_rb_${i}`,
      nome: `Rabicho ${b}/${num}`, codigo: `RAB-${b.replace('²', '2')}-${num}`,
      categoria: 'Rabichos', subcategoria: 'jogo_curto',
      bitola: b, numero: parseInt(num), metragem: '10m', tipo: 'Rabicho 3F+N',
      status: 'disponivel', eventoAtual: null, estoqueMin: 1, estoqueAtual: 1,
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
      id: `mat_ot_${i}`, nome: o.nome, codigo: o.codigo,
      categoria: 'Outros Materiais', subcategoria: 'geral',
      bitola: null, numero: null, metragem: null, tipo: o.tipo,
      status: 'disponivel', eventoAtual: null, estoqueMin: 2,
      estoqueAtual: Math.floor(Math.random() * 4) + 1,
    })
  })

  return items
}

export async function seedDatabase() {
  const batch = writeBatch(db)

  for (const evt of eventos) {
    batch.set(doc(db, 'eventos', evt.id), { ...evt, criadoEm: serverTimestamp() })
  }

  const geradores = buildGeradores()
  for (const gg of geradores) {
    batch.set(doc(db, 'geradores', gg.id), { ...gg, criadoEm: serverTimestamp() })
  }

  const filtros = buildFiltros()
  for (const f of filtros) {
    batch.set(doc(db, 'filtros', f.id), { ...f, criadoEm: serverTimestamp() })
  }

  const materiais = buildMateriais()
  for (const mat of materiais) {
    batch.set(doc(db, 'materiais', mat.id), { ...mat, criadoEm: serverTimestamp() })
  }

  batch.set(doc(db, 'contadores', 'ordens_saida'), { ultimo: 0 })
  batch.set(doc(db, 'contadores', 'ordens_servico'), { ultimo: 0 })

  await batch.commit()
  console.log(`Seed: ${eventos.length} eventos, ${geradores.length} geradores, ${filtros.length} filtros, ${materiais.length} materiais`)
  return { eventos: eventos.length, geradores: geradores.length, filtros: filtros.length, materiais: materiais.length }
}

const FILTROS_REAIS = [
  {"id": "flt_gg_001_comb1", "ggId": "GG-001", "potenciaGG": "180KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-001", "referencia": "FF 5018 Fleetguard 2 pças", "referenciaCompleta": "FF 5018 Fleetguard 2 pças", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_001_oleo", "ggId": "GG-001", "potenciaGG": "180KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-001", "referencia": "LF 3346 Fleetguard", "referenciaCompleta": "LF 3346 Fleetguard ou W1170 Mann - P550920 Donaldosn", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_001_ar", "ggId": "GG-001", "potenciaGG": "180KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-001", "referencia": "HP 3004", "referenciaCompleta": "HP 3004 ou TR1524 Filtros Turbo", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_010_comb1", "ggId": "GG-010", "potenciaGG": "115KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-010", "referencia": "FF 4052A Fleetguard", "referenciaCompleta": "FF 4052A Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_010_sep", "ggId": "GG-010", "potenciaGG": "115KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-010", "referencia": "R-26 A50 Parker Racor", "referenciaCompleta": "R-26 A50 Parker Racor", "fornecedor": "Parker Racor", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_010_oleo", "ggId": "GG-010", "potenciaGG": "115KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-010", "referencia": "LF 701 Fleetguard", "referenciaCompleta": "LF 701 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_010_ar", "ggId": "GG-010", "potenciaGG": "115KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-010", "referencia": "CF-400/1 Mann Filter", "referenciaCompleta": "CF-400/1 Mann Filter e AF26931 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_012_comb1", "ggId": "GG-012", "potenciaGG": "110KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-012", "referencia": "FF5626 Fleetguard", "referenciaCompleta": "FF5626 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_012_oleo", "ggId": "GG-012", "potenciaGG": "110KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-012", "referencia": "500086363 FPT", "referenciaCompleta": "500086363 FPT", "fornecedor": "FPT", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_012_ar", "ggId": "GG-012", "potenciaGG": "110KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-012", "referencia": "AF2555700 Fleetguard", "referenciaCompleta": "AF2555700 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_013_comb1", "ggId": "GG-013", "potenciaGG": "33KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-013", "referencia": "FF 167A Fleetgurd", "referenciaCompleta": "FF 167A Fleetgurd ou PC2/155 TECFIL", "fornecedor": "Tecfil", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_013_oleo", "ggId": "GG-013", "potenciaGG": "33KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-013", "referencia": "LF 700 Fleetguard", "referenciaCompleta": "LF 700 Fleetguard ou PSL 408 TECFIL", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_013_ar", "ggId": "GG-013", "potenciaGG": "33KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-013", "referencia": "901-046", "referenciaCompleta": "901-046 ou AF 25539 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_014_comb1", "ggId": "GG-014", "potenciaGG": "34KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-014", "referencia": "FF 167A Fleetgurd", "referenciaCompleta": "FF 167A Fleetgurd", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_014_oleo", "ggId": "GG-014", "potenciaGG": "34KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-014", "referencia": "LF 700 Fleetguard", "referenciaCompleta": "LF 700 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_014_ar", "ggId": "GG-014", "potenciaGG": "34KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-014", "referencia": "901-046", "referenciaCompleta": "901-046 ou AF 25539 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_019_comb1", "ggId": "GG-019", "potenciaGG": "300KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-019", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_019_oleo", "ggId": "GG-019", "potenciaGG": "300KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-019", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_019_ar", "ggId": "GG-019", "potenciaGG": "300KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-019", "referencia": "AF 25066 Fleetguard", "referenciaCompleta": "AF 25066 Fleetguard ou LX 531 Mahle", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_020_comb1", "ggId": "GG-020", "potenciaGG": "300KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-020", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_020_comb2", "ggId": "GG-020", "potenciaGG": "300KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-020", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_020_oleo", "ggId": "GG-020", "potenciaGG": "300KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-020", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_020_ar", "ggId": "GG-020", "potenciaGG": "300KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-020", "referencia": "C 27 1340 Mann Filter", "referenciaCompleta": "C 27 1340 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_021_comb1", "ggId": "GG-021", "potenciaGG": "300KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-021", "referencia": "WK 1060/2 MANN FILTER", "referenciaCompleta": "WK 1060/2 MANN FILTER", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_021_comb2", "ggId": "GG-021", "potenciaGG": "300KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-021", "referencia": "FF5683 Fleetguard", "referenciaCompleta": "FF5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_021_oleo", "ggId": "GG-021", "potenciaGG": "300KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-021", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_023_comb1", "ggId": "GG-023", "potenciaGG": "165KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-023", "referencia": "FS19811 Fleetguard", "referenciaCompleta": "FS19811 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_023_sep", "ggId": "GG-023", "potenciaGG": "165KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-023", "referencia": "FS19832 Fleetguard", "referenciaCompleta": "FS19832 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_023_oleo", "ggId": "GG-023", "potenciaGG": "165KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-023", "referencia": "LF701 Fleetguard (02 Unidades)", "referenciaCompleta": "LF701 Fleetguard (02 Unidades)", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_025_comb1", "ggId": "GG-025", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-025", "referencia": "Filtro de combustível WK940/12  Mann Filter", "referenciaCompleta": "Filtro de combustível WK940/12  Mann Filter ou Similar FF 5297 Fleetguard ou similar FF5626", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_025_oleo", "ggId": "GG-025", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-025", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_025_ar", "ggId": "GG-025", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-025", "referencia": "AF25066 Fleetguard", "referenciaCompleta": "AF25066 Fleetguard ou C 30 703 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_026_comb1", "ggId": "GG-026", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-026", "referencia": "2020TM-OR Parker Racor", "referenciaCompleta": "2020TM-OR Parker Racor", "fornecedor": "Parker Racor", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_026_oleo", "ggId": "GG-026", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-026", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_031_comb1", "ggId": "GG-031", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-031", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard ou RC-381 Parker Racor", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_031_sep", "ggId": "GG-031", "potenciaGG": "500KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-031", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_031_oleo", "ggId": "GG-031", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-031", "referencia": "WK 11102/18 Mann Filter", "referenciaCompleta": "WK 11102/18 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_032_comb1", "ggId": "GG-032", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-032", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard ou RC-381 Parker Racor", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_032_comb2", "ggId": "GG-032", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-032", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_032_oleo", "ggId": "GG-032", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-032", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_038_comb1", "ggId": "GG-038", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-038", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_038_sep", "ggId": "GG-038", "potenciaGG": "500KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-038", "referencia": "1393640 Scania", "referenciaCompleta": "1393640 Scania", "fornecedor": "Scania", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_038_oleo", "ggId": "GG-038", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-038", "referencia": "2059778 Scania", "referenciaCompleta": "2059778 Scania", "fornecedor": "Scania", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_038_ar", "ggId": "GG-038", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-038", "referencia": "AF 25066 Fleetguard", "referenciaCompleta": "AF 25066 Fleetguard ou LX 531 Mahle", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_040_comb1", "ggId": "GG-040", "potenciaGG": "750KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-040", "referencia": "CH10931 Perkis", "referenciaCompleta": "CH10931 Perkis", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_040_comb2", "ggId": "GG-040", "potenciaGG": "750KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-040", "referencia": "CH10930 Perkins", "referenciaCompleta": "CH10930 Perkins", "fornecedor": "Perkins", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_040_oleo", "ggId": "GG-040", "potenciaGG": "750KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-040", "referencia": "CH10929 Perkis", "referenciaCompleta": "CH10929 Perkis", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_040_ar", "ggId": "GG-040", "potenciaGG": "750KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-040", "referencia": "P182040 Donaldson", "referenciaCompleta": "P182040 Donaldson", "fornecedor": "Donaldson", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_041_comb1", "ggId": "GG-041", "potenciaGG": "750KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-041", "referencia": "CH10931 Perkis", "referenciaCompleta": "CH10931 Perkis", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_041_comb2", "ggId": "GG-041", "potenciaGG": "750KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-041", "referencia": "CH10930 Perkins", "referenciaCompleta": "CH10930 Perkins", "fornecedor": "Perkins", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_041_oleo", "ggId": "GG-041", "potenciaGG": "750KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-041", "referencia": "CH10929 Perkis", "referenciaCompleta": "CH10929 Perkis", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_041_ar", "ggId": "GG-041", "potenciaGG": "750KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-041", "referencia": "P182040 Donaldson", "referenciaCompleta": "P182040 Donaldson", "fornecedor": "Donaldson", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_042_comb1", "ggId": "GG-042", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-042", "referencia": "P505932 Donaldson", "referenciaCompleta": "P505932 Donaldson", "fornecedor": "Donaldson", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_042_comb2", "ggId": "GG-042", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-042", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_042_oleo", "ggId": "GG-042", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-042", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_042_ar", "ggId": "GG-042", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-042", "referencia": "395773 GC 7729 Scania", "referenciaCompleta": "395773 GC 7729 Scania ou AF 25066 Fleetguard ou MAHLE LX 531", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_043_comb1", "ggId": "GG-043", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-043", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_043_sep", "ggId": "GG-043", "potenciaGG": "500KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-043", "referencia": "WK  1060/2 Mann Filter", "referenciaCompleta": "WK  1060/2 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_043_oleo", "ggId": "GG-043", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-043", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_044_comb1", "ggId": "GG-044", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-044", "referencia": "RC-381 Parker Racor (Similar Sania 1733776", "referenciaCompleta": "RC-381 Parker Racor (Similar Sania 1733776 ou WK 940/12 Mann Filter)", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_044_comb2", "ggId": "GG-044", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-044", "referencia": "2020 PM-OR Parker Racor", "referenciaCompleta": "2020 PM-OR Parker Racor", "fornecedor": "Parker Racor", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_044_oleo", "ggId": "GG-044", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-044", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_046_comb1", "ggId": "GG-046", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-046", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_046_oleo", "ggId": "GG-046", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-046", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_046_ar", "ggId": "GG-046", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-046", "referencia": "AF 25066 Fleetguard", "referenciaCompleta": "AF 25066 Fleetguard ou LX 531 Mahle", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_047_comb1", "ggId": "GG-047", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-047", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_047_comb2", "ggId": "GG-047", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-047", "referencia": "Filtro de combustível 2020TM-OR Parker Racor", "referenciaCompleta": "Filtro de combustível 2020TM-OR Parker Racor", "fornecedor": "Parker Racor", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_047_oleo", "ggId": "GG-047", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-047", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_047_ar", "ggId": "GG-047", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-047", "referencia": "AF 25066 Fleetguard", "referenciaCompleta": "AF 25066 Fleetguard ou LX 531 Mahle", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_048_comb1", "ggId": "GG-048", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-048", "referencia": "FF 5297 Fleetguard", "referenciaCompleta": "FF 5297 Fleetguard ou WK 940/12 Mann Filter ou P505932 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_048_sep", "ggId": "GG-048", "potenciaGG": "500KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-048", "referencia": "FS19551 Fleetguard", "referenciaCompleta": "FS19551 Fleetguard ou FS36270 Fleeguard ou R120 LJ - 10M - AQII Parker", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_048_oleo", "ggId": "GG-048", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-048", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_048_ar", "ggId": "GG-048", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-048", "referencia": "SCANIA 395773", "referenciaCompleta": "SCANIA 395773 ou AF25066 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_049_comb1", "ggId": "GG-049", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-049", "referencia": "WK 940/12 Mann Filter", "referenciaCompleta": "WK 940/12 Mann Filter ou P505932 Donaldson ou FF 5297 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_049_comb2", "ggId": "GG-049", "potenciaGG": "500KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-049", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_049_oleo", "ggId": "GG-049", "potenciaGG": "500KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-049", "referencia": "W 11102/18 Mann Filter", "referenciaCompleta": "W 11102/18 Mann Filter ou LF667 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_049_ar", "ggId": "GG-049", "potenciaGG": "500KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-049", "referencia": "AF 25066 Fleetguard", "referenciaCompleta": "AF 25066 Fleetguard ou LX 531 Mahle", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_051_comb1", "ggId": "GG-051", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-051", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou FF5074 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_051_comb2", "ggId": "GG-051", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-051", "referencia": "WK 940/7 Mann Filter", "referenciaCompleta": "WK 940/7 Mann Filter ou FF 200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_052_comb1", "ggId": "GG-052", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-052", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_052_sep", "ggId": "GG-052", "potenciaGG": "120KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-052", "referencia": "WK 940/7 Mann filter", "referenciaCompleta": "WK 940/7 Mann filter ou FS 1280 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_052_oleo", "ggId": "GG-052", "potenciaGG": "120KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-052", "referencia": "LF 3345 fleetguard", "referenciaCompleta": "LF 3345 fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_052_ar", "ggId": "GG-052", "potenciaGG": "120KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-052", "referencia": "AF25960 AF 25961 Fleetguard P628326 P629466 Donaldson", "referenciaCompleta": "AF25960 AF 25961 Fleetguard P628326 P629466 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_053_comb1", "ggId": "GG-053", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-053", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_053_comb2", "ggId": "GG-053", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-053", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_053_oleo", "ggId": "GG-053", "potenciaGG": "120KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-053", "referencia": "LF 3345 fleetguard", "referenciaCompleta": "LF 3345 fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_053_ar", "ggId": "GG-053", "potenciaGG": "120KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-053", "referencia": "AF25960 AF 25961 Fleetguard", "referenciaCompleta": "AF25960 AF 25961 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_054_comb1", "ggId": "GG-054", "potenciaGG": "120KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-054", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_054_sep", "ggId": "GG-054", "potenciaGG": "120KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-054", "referencia": "FS12080 Fleetguard", "referenciaCompleta": "FS12080 Fleetguard ou FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_054_oleo", "ggId": "GG-054", "potenciaGG": "120KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-054", "referencia": "LF 3345 fleetguard", "referenciaCompleta": "LF 3345 fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_054_ar", "ggId": "GG-054", "potenciaGG": "120KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-054", "referencia": "AF25960 AF 25961 Fleetguard", "referenciaCompleta": "AF25960 AF 25961 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_055_comb1", "ggId": "GG-055", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-055", "referencia": "FF 261 Fleetguard P502504 Donaldson", "referenciaCompleta": "FF 261 Fleetguard P502504 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_055_comb2", "ggId": "GG-055", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-055", "referencia": "10000-59647 FG Wilson", "referenciaCompleta": "10000-59647 FG Wilson", "fornecedor": "FG Wilson", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_055_sep", "ggId": "GG-055", "potenciaGG": "220KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-055", "referencia": "FS  20052 Fleetguard", "referenciaCompleta": "FS  20052 Fleetguard ou P553880", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_055_oleo", "ggId": "GG-055", "potenciaGG": "220KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-055", "referencia": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133)", "referenciaCompleta": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133) ou P550920 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_055_ar", "ggId": "GG-055", "potenciaGG": "220KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-055", "referencia": "AF 27840 Fleetguard", "referenciaCompleta": "AF 27840 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_056_comb1", "ggId": "GG-056", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-056", "referencia": "FF 261 Fleetguard P502504 Donaldson", "referenciaCompleta": "FF 261 Fleetguard P502504 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_056_comb2", "ggId": "GG-056", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-056", "referencia": "10000-59647 FG Wilson", "referenciaCompleta": "10000-59647 FG Wilson", "fornecedor": "FG Wilson", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_056_sep", "ggId": "GG-056", "potenciaGG": "220KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-056", "referencia": "FS  20052 Fleetguard", "referenciaCompleta": "FS  20052 Fleetguard ou P553880", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_056_oleo", "ggId": "GG-056", "potenciaGG": "220KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-056", "referencia": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133)", "referenciaCompleta": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133) ou P550920 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_056_ar", "ggId": "GG-056", "potenciaGG": "220KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-056", "referencia": "AF 27840 Fleetguard", "referenciaCompleta": "AF 27840 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_057_comb1", "ggId": "GG-057", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-057", "referencia": "FF 261 Fleetguard P502504 Donaldson", "referenciaCompleta": "FF 261 Fleetguard P502504 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_057_comb2", "ggId": "GG-057", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-057", "referencia": "10000-59647 FG  Wilson", "referenciaCompleta": "10000-59647 FG  Wilson", "fornecedor": "N/I", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_057_sep", "ggId": "GG-057", "potenciaGG": "220KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-057", "referencia": "FS  20052 Fleetguard", "referenciaCompleta": "FS  20052 Fleetguard ou P553880", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_057_oleo", "ggId": "GG-057", "potenciaGG": "220KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-057", "referencia": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133)", "referenciaCompleta": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133) ou P550920 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_057_ar", "ggId": "GG-057", "potenciaGG": "220KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-057", "referencia": "AF 27840 Fleetguard", "referenciaCompleta": "AF 27840 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_058_comb1", "ggId": "GG-058", "potenciaGG": "170KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-058", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter ou FF5074 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_058_sep", "ggId": "GG-058", "potenciaGG": "170KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-058", "referencia": "WK940/7 Mann Filter", "referenciaCompleta": "WK940/7 Mann Filter ou FS 1280 Fleetguard ou FF 200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_058_oleo", "ggId": "GG-058", "potenciaGG": "170KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-058", "referencia": "LF 3959 Fleetguard", "referenciaCompleta": "LF 3959 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_058_ar", "ggId": "GG-058", "potenciaGG": "170KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-058", "referencia": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 ", "referenciaCompleta": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 Fleetguard) (AE1162RS Especialista AF26120 Fleetguard)", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_059_comb1", "ggId": "GG-059", "potenciaGG": "170KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-059", "referencia": "FF200 Fleetguard", "referenciaCompleta": "FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_059_sep", "ggId": "GG-059", "potenciaGG": "170KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-059", "referencia": "WK 940/7 Mann Filter", "referenciaCompleta": "WK 940/7 Mann Filter ou FS 1280  FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_059_oleo", "ggId": "GG-059", "potenciaGG": "170KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-059", "referencia": "LF 3345 fleetguard", "referenciaCompleta": "LF 3345 fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_059_ar", "ggId": "GG-059", "potenciaGG": "170KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-059", "referencia": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 ", "referenciaCompleta": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 Fleetguard) (AE1162RS Especialista AF26120 Fleetguard)", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_060_comb1", "ggId": "GG-060", "potenciaGG": "170KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-060", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou FF5074 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_060_sep", "ggId": "GG-060", "potenciaGG": "170KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-060", "referencia": "WK 940/7 Mann Filter", "referenciaCompleta": "WK 940/7 Mann Filter ou FS 1280  FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_060_oleo", "ggId": "GG-060", "potenciaGG": "170KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-060", "referencia": "LF 3959 Fleetguard", "referenciaCompleta": "LF 3959 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_060_ar", "ggId": "GG-060", "potenciaGG": "170KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-060", "referencia": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 ", "referenciaCompleta": "AF 26120 AF 26121 Fleetguard (AI3129RS Especialista AF26121 Fleetguard) (AE1162RS Especialista AF26120 Fleetguard)", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_061_comb1", "ggId": "GG-061", "potenciaGG": "81KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-061", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_061_comb2", "ggId": "GG-061", "potenciaGG": "81KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-061", "referencia": "WK 940/7 Mann Filter", "referenciaCompleta": "WK 940/7 Mann Filter ou FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_061_oleo", "ggId": "GG-061", "potenciaGG": "81KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-061", "referencia": "OC333 Mahle", "referenciaCompleta": "OC333 Mahle ou LF3345 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_061_ar", "ggId": "GG-061", "potenciaGG": "81KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-061", "referencia": "AF 25960 (Primário) AF25961 (Secundário) Fleetguard", "referenciaCompleta": "AF 25960 (Primário) AF25961 (Secundário) Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_062_comb1", "ggId": "GG-062", "potenciaGG": "81KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-062", "referencia": "FF 5052 Fleetguard", "referenciaCompleta": "FF 5052 Fleetguard ou WK 723 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_062_comb2", "ggId": "GG-062", "potenciaGG": "81KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-062", "referencia": "WK 940/7 Mann Filter", "referenciaCompleta": "WK 940/7 Mann Filter ou FF200 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_062_oleo", "ggId": "GG-062", "potenciaGG": "81KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-062", "referencia": "OC333 Mahle", "referenciaCompleta": "OC333 Mahle ou LF3345 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_062_ar", "ggId": "GG-062", "potenciaGG": "81KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-062", "referencia": "AF 25960 (Primário) AF25961 (Secundário) Fleetguard", "referenciaCompleta": "AF 25960 (Primário) AF25961 (Secundário) Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_064_comb1", "ggId": "GG-064", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-064", "referencia": "FF 261 Fleetguard P502504 Donaldson", "referenciaCompleta": "FF 261 Fleetguard P502504 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_064_sep", "ggId": "GG-064", "potenciaGG": "220KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-064", "referencia": "FS  20052 Fleetguard", "referenciaCompleta": "FS  20052 Fleetguard ou P553880", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_064_oleo", "ggId": "GG-064", "potenciaGG": "220KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-064", "referencia": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133)", "referenciaCompleta": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133) ou P550920 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_064_ar", "ggId": "GG-064", "potenciaGG": "220KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-064", "referencia": "AF27840 Fleetguard", "referenciaCompleta": "AF27840 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_066_comb1", "ggId": "GG-066", "potenciaGG": "50KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-066", "referencia": "Filtro de combustível 9.0541.14.2.0009 MWM", "referenciaCompleta": "Filtro de combustível 9.0541.14.2.0009 MWM", "fornecedor": "MWM", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_066_oleo", "ggId": "GG-066", "potenciaGG": "50KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-066", "referencia": "N°9.0541.13.8.0012 MWM", "referenciaCompleta": "N°9.0541.13.8.0012 MWM", "fornecedor": "MWM", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_067_comb1", "ggId": "GG-067", "potenciaGG": "220KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-067", "referencia": "FF 261 Fleetguard P502504 Donaldson", "referenciaCompleta": "FF 261 Fleetguard P502504 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_067_sep", "ggId": "GG-067", "potenciaGG": "220KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-067", "referencia": "FS  20052 Fleetguard", "referenciaCompleta": "FS  20052 Fleetguard ou P553880", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_067_oleo", "ggId": "GG-067", "potenciaGG": "220KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-067", "referencia": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133)", "referenciaCompleta": "LF 17475 Fleetguard  - 2656A111 Perkins (Sub.4627133) ou P550920 Donaldson", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_067_ar", "ggId": "GG-067", "potenciaGG": "220KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-067", "referencia": "AF27840 Fleetguard", "referenciaCompleta": "AF27840 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_069_oleo", "ggId": "GG-069", "potenciaGG": "180KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-069", "referencia": "MWM N°9.0541.18.8.0013", "referenciaCompleta": "MWM N°9.0541.18.8.0013 ou W 1170 Mann Filter ou LF 3345 Fleetgurd", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_069_ar", "ggId": "GG-069", "potenciaGG": "180KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-069", "referencia": "C 23 610 Mann (Primário) - CF 600/1 Mann (secundário) \"Simil", "referenciaCompleta": "C 23 610 Mann (Primário) - CF 600/1 Mann (secundário) \"Similar WIX WA449783", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_070_comb1", "ggId": "GG-070", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-070", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_070_comb2", "ggId": "GG-070", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-070", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_070_oleo", "ggId": "GG-070", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-070", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_070_ar", "ggId": "GG-070", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-070", "referencia": "AF 25170 Fleetguard P952024 Donalsosn", "referenciaCompleta": "AF 25170 Fleetguard P952024 Donalsosn", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_071_comb1", "ggId": "GG-071", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-071", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_071_comb2", "ggId": "GG-071", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-071", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_071_oleo", "ggId": "GG-071", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-071", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_071_ar", "ggId": "GG-071", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-071", "referencia": "AF 25170 Fleetguard /", "referenciaCompleta": "AF 25170 Fleetguard / ou Turbo 30346", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_072_comb1", "ggId": "GG-072", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-072", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_072_comb2", "ggId": "GG-072", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-072", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_072_oleo", "ggId": "GG-072", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-072", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_072_ar", "ggId": "GG-072", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-072", "referencia": "AF 25170 Fleetguard", "referenciaCompleta": "AF 25170 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_073_comb1", "ggId": "GG-073", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-073", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_073_oleo", "ggId": "GG-073", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-073", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_073_ar", "ggId": "GG-073", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-073", "referencia": "AF 25170 Fleetguard", "referenciaCompleta": "AF 25170 Fleetguard ou Original Scania 1931049 P", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_074_comb1", "ggId": "GG-074", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-074", "referencia": "FF 5683 Fleetguard", "referenciaCompleta": "FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_074_comb2", "ggId": "GG-074", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-074", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_074_oleo", "ggId": "GG-074", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-074", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_074_ar", "ggId": "GG-074", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-074", "referencia": "AF 25170 Fleetguard", "referenciaCompleta": "AF 25170 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_075_comb1", "ggId": "GG-075", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-075", "referencia": "FF5421 Fleetguard - FF 5683 Fleetguard", "referenciaCompleta": "FF5421 Fleetguard - FF 5683 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_075_comb2", "ggId": "GG-075", "potenciaGG": "550KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-075", "referencia": "WK 1060/2 Mann Filter", "referenciaCompleta": "WK 1060/2 Mann Filter ou FS19551 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_075_oleo", "ggId": "GG-075", "potenciaGG": "550KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-075", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_075_ar", "ggId": "GG-075", "potenciaGG": "550KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-075", "referencia": "AF 25170 Fleetguard", "referenciaCompleta": "AF 25170 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_076_comb1", "ggId": "GG-076", "potenciaGG": "251KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-076", "referencia": "WK 950/21 Mann Filter", "referenciaCompleta": "WK 950/21 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_076_sep", "ggId": "GG-076", "potenciaGG": "251KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-076", "referencia": "WK 950/30 Mann Filter", "referenciaCompleta": "WK 950/30 Mann Filter ou RC-811 Parker Racor ou FS19821 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_076_oleo", "ggId": "GG-076", "potenciaGG": "251KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-076", "referencia": "W 950/26 Mann Filter", "referenciaCompleta": "W 950/26 Mann Filter ou LF 16015 Fleetguard ou LF17516 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_076_ar", "ggId": "GG-076", "potenciaGG": "251KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-076", "referencia": "8041419 Iveco - AF27918 Fleetguard - AE1367RS  Especialista ", "referenciaCompleta": "8041419 Iveco - AF27918 Fleetguard - AE1367RS  Especialista - RS5391 Baldwin", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_077_comb1", "ggId": "GG-077", "potenciaGG": "251KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-077", "referencia": "FF5421 Fleetguard - WK 950/21 Mann Filter", "referenciaCompleta": "FF5421 Fleetguard - WK 950/21 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_077_sep", "ggId": "GG-077", "potenciaGG": "251KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-077", "referencia": "WK 950/19 Mann Filter", "referenciaCompleta": "WK 950/19 Mann Filter ou RC-811 Parker Racor ou FS19821 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_077_oleo", "ggId": "GG-077", "potenciaGG": "251KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-077", "referencia": "W 950/26 Mann Filter", "referenciaCompleta": "W 950/26 Mann Filter ou LF 16015 Fleetguard ou LF17516 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_077_ar", "ggId": "GG-077", "potenciaGG": "251KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-077", "referencia": "AF27918 Fleetguard", "referenciaCompleta": "AF27918 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_078_comb1", "ggId": "GG-078", "potenciaGG": "251KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-078", "referencia": "FF5421 Fleetguard WK 950/21 Mann Filter", "referenciaCompleta": "FF5421 Fleetguard WK 950/21 Mann Filter", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_078_sep", "ggId": "GG-078", "potenciaGG": "251KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-078", "referencia": "FS19821 Fleetguard WK 950/19 Mann Filter", "referenciaCompleta": "FS19821 Fleetguard WK 950/19 Mann Filter ou RC-811 Parker Racor ou FS19821 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_078_oleo", "ggId": "GG-078", "potenciaGG": "251KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-078", "referencia": "W 950/26 Mann Filter", "referenciaCompleta": "W 950/26 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_078_ar", "ggId": "GG-078", "potenciaGG": "251KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-078", "referencia": "AF27918 Fleetguard", "referenciaCompleta": "AF27918 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_079_comb1", "ggId": "GG-079", "potenciaGG": "251KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-079", "referencia": "WK 950/21 Mann Filter", "referenciaCompleta": "WK 950/21 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_079_sep", "ggId": "GG-079", "potenciaGG": "251KVA", "tipo": "Filtro Separador de Água", "nome": "Filtro Separador de Água — GG-079", "referencia": "WK 950/19 Mann Filter", "referenciaCompleta": "WK 950/19 Mann Filter ou RC-811 Parker Racor ou FS19821 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_079_oleo", "ggId": "GG-079", "potenciaGG": "251KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-079", "referencia": "W 950/26 Mann Filter", "referenciaCompleta": "W 950/26 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_079_ar", "ggId": "GG-079", "potenciaGG": "251KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-079", "referencia": "AF27918 Fleetguard", "referenciaCompleta": "AF27918 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_080_comb1", "ggId": "GG-080", "potenciaGG": "320KVA", "tipo": "Filtro de Combustível 1", "nome": "Filtro de Combustível 1 — GG-080", "referencia": "Filtro de combustível WK 1060/2 Mann Filter", "referenciaCompleta": "Filtro de combustível WK 1060/2 Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_080_comb2", "ggId": "GG-080", "potenciaGG": "320KVA", "tipo": "Filtro de Combustível 2", "nome": "Filtro de Combustível 2 — GG-080", "referencia": "FF 5686 Fleetguard", "referenciaCompleta": "FF 5686 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_080_oleo", "ggId": "GG-080", "potenciaGG": "320KVA", "tipo": "Filtro de Óleo", "nome": "Filtro de Óleo — GG-080", "referencia": "HU 1077/1X Mann Filter", "referenciaCompleta": "HU 1077/1X Mann Filter ou HU 1077/2 z Mann Filter", "fornecedor": "Mann Filter", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
  {"id": "flt_gg_080_ar", "ggId": "GG-080", "potenciaGG": "320KVA", "tipo": "Filtro de Ar", "nome": "Filtro de Ar — GG-080", "referencia": "AF25170 Fleetguard", "referenciaCompleta": "AF25170 Fleetguard", "fornecedor": "Fleetguard", "quantidadeAtual": 0, "estoqueMin": 2, "unidade": "un", "ativo": true},
]

export async function seedFiltrosReais() {
  const batch = writeBatch(db)
  for (const f of FILTROS_REAIS) {
    batch.set(doc(db, 'filtros', f.id), { ...f, criadoEm: serverTimestamp() })
  }
  await batch.commit()
  console.log(`Filtros reais: ${FILTROS_REAIS.length} inseridos`)
  return FILTROS_REAIS.length
}

const MATERIAIS_REAIS = [
  {"id": "mat_t11065", "nome": "Cabo terra 1x10/65/6m", "codigo": "T11065", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "1x10", "metragem": "6m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t11070", "nome": "Cabo terra 1x10/70/6m", "codigo": "T11070", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "1x10", "metragem": "6m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t1680", "nome": "Cabo terra 1x16/80/80m", "codigo": "T1680", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "1x16", "metragem": "80m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t11023", "nome": "Cabo terra 1x10/23/23m", "codigo": "T11023", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "1x10", "metragem": "23m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t7002", "nome": "Cabo terra 70/02/10m CAMLOCK (F)", "codigo": "T7002", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "70", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t7012", "nome": "Cabo terra 70/12/12m", "codigo": "T7012", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "70", "metragem": "12m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t7050", "nome": "Cabo terra 70/50/10m CAMLOCK (F)", "codigo": "T7050", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "70", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9502", "nome": "Cabo terra 95/02/25m", "codigo": "T9502", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9505", "nome": "Cabo terra 95/05/25m", "codigo": "T9505", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9506", "nome": "Cabo terra 95/06/49m", "codigo": "T9506", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "49m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9508", "nome": "Cabo terra 95/08/50m", "codigo": "T9508", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "50m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9516", "nome": "Cabo terra 95/16/25m", "codigo": "T9516", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9526", "nome": "Cabo terra 95/26/25m", "codigo": "T9526", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9527", "nome": "Cabo terra 95/27/25m", "codigo": "T9527", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Praça das Fontes", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t9531", "nome": "Cabo terra 95/31/50m", "codigo": "T9531", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "50m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9532", "nome": "Cabo terra 95/32/49m", "codigo": "T9532", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "49m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9535", "nome": "Cabo terra 95/35/49m", "codigo": "T9535", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "49m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9541", "nome": "Cabo terra 95/41/25m", "codigo": "T9541", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9547", "nome": "Cabo terra 95/47/49m", "codigo": "T9547", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "49m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9552", "nome": "Cabo terra 95/52/5,50m", "codigo": "T9552", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "5.50m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Praça das Fontes", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t9558", "nome": "Cabo terra 95/58/10m", "codigo": "T9558", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9559", "nome": "Cabo terra 95/59/10m", "codigo": "T9559", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9560", "nome": "Cabo terra 95/60/10m", "codigo": "T9560", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9561", "nome": "Cabo terra 95/61/10m", "codigo": "T9561", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "10m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t9562", "nome": "Cabo terra 95/62/9m", "codigo": "T9562", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "9m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9563", "nome": "Cabo terra 95/63/6m", "codigo": "T9563", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "6m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9565", "nome": "Cabo terra 95/65/30m", "codigo": "T9565", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t9566", "nome": "Cabo terra 95/66/48m", "codigo": "T9566", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "95", "metragem": "48m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12001", "nome": "Cabo terra 120/01/30m", "codigo": "T12001", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12002", "nome": "Cabo terra 120/02/25m", "codigo": "T12002", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "25m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12012", "nome": "Cabo terra 120/12/30m", "codigo": "T12012", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12014", "nome": "Cabo terra 120/14/30m", "codigo": "T12014", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12015", "nome": "Cabo terra 120/15/30m", "codigo": "T12015", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12017", "nome": "Cabo terra 120/17/15m", "codigo": "T12017", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "15m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12023", "nome": "Cabo terra 120/23/5m", "codigo": "T12023", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "5m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12035", "nome": "Cabo terra 120/35/49m", "codigo": "T12035", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "49m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12039", "nome": "Cabo terra 120/39/8m", "codigo": "T12039", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "8m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t12041", "nome": "Cabo terra 120/41/30m", "codigo": "T12041", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t12048", "nome": "Cabo terra 120/48/30m", "codigo": "T12048", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_t12064", "nome": "Cabo terra 120/64/30m", "codigo": "T12064", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "30m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_t12065", "nome": "Cabo terra 120/65/11m", "codigo": "T12065", "categoria": "Cabos Terra", "subcategoria": "cabos_terra", "bitola": "120", "metragem": "11m", "numero": null, "tipo": "Cabos Terra", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c4651", "nome": "Cabo 4x6/51/14m", "codigo": "C4651", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x6", "metragem": "14m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c5666", "nome": "Cabo 5x6/66/20m", "codigo": "C5666", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x6", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51018", "nome": "Cabo 5x10/18/75m", "codigo": "C51018", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "75m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51020", "nome": "Cabo 5x10/20/60m", "codigo": "C51020", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "60m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51021", "nome": "Cabo 5x10/21/20m", "codigo": "C51021", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51027", "nome": "Cabo 5x10/27/51m", "codigo": "C51027", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "51m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51028", "nome": "Cabo 5x10/28/26m", "codigo": "C51028", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "26m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51029", "nome": "Cabo 5x10/29/23m", "codigo": "C51029", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "23m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51060", "nome": "Cabo 5x10/60/53m", "codigo": "C51060", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "53m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c51061", "nome": "cabo 5x10/61/62m", "codigo": "C51061", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "5x10", "metragem": "62m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41050", "nome": "Cabo 4x10/50/46m", "codigo": "C41050", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x10", "metragem": "46m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41633", "nome": "Cabo 4x16/33/103m", "codigo": "C41633", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "103m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "CICB", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c41659", "nome": "Cabo 4x16/59/51m com terra", "codigo": "C41659", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "51m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41660", "nome": "Cabo 4x16/60/97m", "codigo": "C41660", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "97m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41661", "nome": "Cabo 4x16/61/24m", "codigo": "C41661", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "24m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c461662", "nome": "Cabo 4x16/62/16m", "codigo": "C461662", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "16m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41663", "nome": "Cabo 4x16/63/45m", "codigo": "C41663", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "45m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41664", "nome": "Cabo 4x16/64/24m com terra", "codigo": "C41664", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "24m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c41665", "nome": "Cabo 4x16/65/101m", "codigo": "C41665", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "101m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "CICB", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c41666", "nome": "Cabo 4x16/66/15m", "codigo": "C41666", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x16", "metragem": "15m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42501", "nome": "Cabo 4x25/01/12m", "codigo": "C42501", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "12m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42502", "nome": "Cabo 4x25/02/5m", "codigo": "C42502", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "5m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42503", "nome": "Cabo 4x25/03/6,60m", "codigo": "C42503", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "6.60m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42505", "nome": "Cabo 4x25/05/25m", "codigo": "C42505", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "25m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "CICB", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c42506", "nome": "Cabo 4x25/06/25m", "codigo": "C42506", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "25m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42517", "nome": "Cabo 4x25/17/30m", "codigo": "C42517", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "30m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42527", "nome": "Cabo 4x25/27/49m", "codigo": "C42527", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "49m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42529", "nome": "Cabo 4x25/29/49m", "codigo": "C42529", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "49m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42530", "nome": "Cabo 4x25/30/34m", "codigo": "C42530", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "34m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42531", "nome": "Cabo 4x25/31/62m", "codigo": "C42531", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "62m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42535", "nome": "Cabo 4x25/35/31m", "codigo": "C42535", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "31m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42537", "nome": "Cabo 4x25/37/39m", "codigo": "C42537", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "39m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42555", "nome": "Cabo 4x25/55/9,70m", "codigo": "C42555", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "9.70m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Parque da Cidade", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c42557", "nome": "Cabo 4x25/57/62m", "codigo": "C42557", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "62m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42558", "nome": "Cabo 4x25/58/6m", "codigo": "C42558", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "6m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42559", "nome": "Cabo 4x25/59/41m", "codigo": "C42559", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "41m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42561", "nome": "Cabo 4x25/61/19m", "codigo": "C42561", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "19m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c42580", "nome": "Cabo 4x25/80/80m", "codigo": "C42580", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "80m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c425125", "nome": "Cabo 4x25/125/125m", "codigo": "C425125", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x25", "metragem": "125m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Embaixada do Peru", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c43501", "nome": "Cabo 4x35/01/7,50m", "codigo": "C43501", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "7.50m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43502", "nome": "Cabo 4x35/02/20m", "codigo": "C43502", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43503", "nome": "Cabo 4x35/03/15m", "codigo": "C43503", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "15m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43506", "nome": "Cabo 4x35/06/15m", "codigo": "C43506", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "15m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43509", "nome": "Cabo 4x35/09/10m", "codigo": "C43509", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "10m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Parque da Cidade", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c43510", "nome": "Cabo 4x35/10/51m", "codigo": "C43510", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "51m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43511", "nome": "Cabo 4x35/11/36m", "codigo": "C43511", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "36m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Shopping Igatemir", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c43516", "nome": "Cabo 4x35/16/31m", "codigo": "C43516", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "31m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43517", "nome": "Cabo 4x35/17/42m", "codigo": "C43517", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "42m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43518", "nome": "Cabo 4x35/18/30m", "codigo": "C43518", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "30m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Shopping Igatemir", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c43519", "nome": "Cabo 4x35/19/24m", "codigo": "C43519", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "24m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43534", "nome": "Cabo 4x35/34/15m", "codigo": "C43534", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "15m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43535", "nome": "Cabo 4x35/35/8m", "codigo": "C43535", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "8m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43559", "nome": "Cabo 4x35/59/3m", "codigo": "C43559", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "3m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43560", "nome": "Cabo 4x35/60/20m", "codigo": "C43560", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43561", "nome": "Cabo 4x35/61/8m", "codigo": "C43561", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "8m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43562", "nome": "Cabo 4x35/62/20m", "codigo": "C43562", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43563", "nome": "Cabo 4x35/63/40m", "codigo": "C43563", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "40m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43564", "nome": "Cabo 4x35/64/8m", "codigo": "C43564", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "8m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c43565", "nome": "Cabo 4x35/65/12m", "codigo": "C43565", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x35", "metragem": "12m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45002", "nome": "Cabo 4x50/02/25m", "codigo": "C45002", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "25m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45006", "nome": "Cabo 4x50/06/13m (Amarelo)", "codigo": "C45006", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "13m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45011", "nome": "Cabo 4x50/11/36m", "codigo": "C45011", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "36m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Shopping Iguatermir", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c45017", "nome": "Cabo 4x50/17/20m", "codigo": "C45017", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45029", "nome": "Cabo 4x50/29/10m CAMLOCK 10m", "codigo": "C45029", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "10m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45051", "nome": "Cabo 4x50/51/5,50m", "codigo": "C45051", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "5.50m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c450255", "nome": "Cabo 4x50/55/27m", "codigo": "C450255", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "27m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45057", "nome": "Cabo 4x50/57/20m", "codigo": "C45057", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "20m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45058", "nome": "Cabo 4x50/58/48m", "codigo": "C45058", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "48m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45059", "nome": "Cabo 4x50/59/58m", "codigo": "C45059", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "58m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45060", "nome": "Cabo 4x50/60/19m", "codigo": "C45060", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "19m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45061", "nome": "Cabo 4x50/61/28m", "codigo": "C45061", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "28m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45062", "nome": "Cabo 4x50/62/26m", "codigo": "C45062", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "26m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_c45064", "nome": "Cabo 4x50/64/66m", "codigo": "C45064", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "66m", "numero": null, "tipo": "Cabos 4x", "status": "em_evento", "eventoAtual": "Parque da Cidade", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_c450140", "nome": "Cabo 4x50/140/140m", "codigo": "C450140", "categoria": "Cabos 4x", "subcategoria": "cabos_4x", "bitola": "4x50", "metragem": "140m", "numero": null, "tipo": "Cabos 4x", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_j7064", "nome": "Jogo de cabo 70/64/24m", "codigo": "J7064", "categoria": "Jogos de Cabo", "subcategoria": "jogos_de_cabo", "bitola": "70", "metragem": "24m", "numero": null, "tipo": "Jogos de Cabo", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_j7065", "nome": "Jogo de cabo 70/65/30m", "codigo": "J7065", "categoria": "Jogos de Cabo", "subcategoria": "jogos_de_cabo", "bitola": "70", "metragem": "30m", "numero": null, "tipo": "Jogos de Cabo", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7012", "nome": "Jogo de rabicho 70/12/14m", "codigo": "R7012", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "14m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7013", "nome": "Jogo de rabicho 70/13/14m", "codigo": "R7013", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "14m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7014", "nome": "Jogo de rabicho 70/14/7,50m", "codigo": "R7014", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "7.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7060", "nome": "Jogo de rabicho 70/60/5m", "codigo": "R7060", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7062", "nome": "Jogo de rabicho 70/62/5m", "codigo": "R7062", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7063", "nome": "Jogo de rabicho 70/63/5m", "codigo": "R7063", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r7066", "nome": "Jogo de rabicho 70/66/3m", "codigo": "R7066", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "70", "metragem": "3m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r9511", "nome": "Jogo de rabicho 95/11/7m", "codigo": "R9511", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "95", "metragem": "7m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r9520", "nome": "Jogo de rabicho 95/20/3,80m", "codigo": "R9520", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "95", "metragem": "3.80m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r9555", "nome": "Jogo de rabicho 95/55/6m", "codigo": "R9555", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "95", "metragem": "6m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r9556", "nome": "Jogo de rabicho 95/56/2,30m", "codigo": "R9556", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "95", "metragem": "2.30m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r9557", "nome": "Jogo de rabicho 95/57/7m", "codigo": "R9557", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "95", "metragem": "7m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12014", "nome": "Jogo de rabicho 120/14/5m", "codigo": "R12014", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r12038", "nome": "Jogo de rabicho 120/38/10m", "codigo": "R12038", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "10m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12042", "nome": "Jogo de rabicho 120/42/5m", "codigo": "R12042", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12044", "nome": "Jogo de rabicho 120/44/14m", "codigo": "R12044", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "14m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r12049", "nome": "Jogo de rabicho 120/49/7,50m", "codigo": "R12049", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "7.50m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r12052", "nome": "Jogo de rabicho 120/52/5,90m", "codigo": "R12052", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5.90m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12053", "nome": "Jogo de rabicho 120/53/5,90m", "codigo": "R12053", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5.90m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12054", "nome": "jogo de rabicho 120/54/9m", "codigo": "R12054", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "9m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12055", "nome": "Jogo de rabicho 120/55/12m", "codigo": "R12055", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "12m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12056", "nome": "Jogo de rabicho 120/56/5,50m", "codigo": "R12056", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12057", "nome": "Jogo de rabicho 120/57/4,80m", "codigo": "R12057", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "4.80m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12058", "nome": "jogo de rabicho 120/58/7,40m", "codigo": "R12058", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "7.40m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r12059", "nome": "Jogo de rabicho 120/59/11m", "codigo": "R12059", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "11m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12060", "nome": "Jogo de rabicho 120/60/9,60m", "codigo": "R12060", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "9.60m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12061", "nome": "Jogo de rabicho 120/61/10m", "codigo": "R12061", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "10m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12063", "nome": "Jogo de rabicho 120/63/11,50m", "codigo": "R12063", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "11.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12065", "nome": "Jogo de rabicho 120/65/5,50m", "codigo": "R12065", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "5.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r12066", "nome": "Jogo de rabicho 120/66/8m", "codigo": "R12066", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "120", "metragem": "8m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r15010", "nome": "Jogo de rabicho 150/10/4m", "codigo": "R15010", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "150", "metragem": "4m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r15014", "nome": "Jogo de rabicho 150/14/5m", "codigo": "R15014", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "150", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r15015", "nome": "Jogo de rabicho 150/15/5m", "codigo": "R15015", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "150", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r15017", "nome": "Jogo de rabicho 150/17/6,70m", "codigo": "R15017", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "150", "metragem": "6.70m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r15820", "nome": "Jogo de rabicho 185/20/6,50m", "codigo": "R15820", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "6.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18522", "nome": "Jogo de rabicho 185/22/4,50m", "codigo": "R18522", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "4.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18524", "nome": "Jogo de rabicho 185/24/7m", "codigo": "R18524", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "7m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r18525", "nome": "Jogo de rabicho 185/25/7m", "codigo": "R18525", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "7m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18526", "nome": "Jogo de rabicho 185/26/5m", "codigo": "R18526", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18550", "nome": "Jogo de rabicho 185/50/8m 3F+N", "codigo": "R18550", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "8m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18559", "nome": "Jogo de rabicho 185/59/6,90m", "codigo": "R18559", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "6.90m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18561", "nome": "Jogo de rabicho 185/61/7m", "codigo": "R18561", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "7m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r18566", "nome": "Jogo de rabicho 185/66/13,50m", "codigo": "R18566", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "185", "metragem": "13.50m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r24010", "nome": "Jogo de rabicho 240/10/3,20m", "codigo": "R24010", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "3.20m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r24016", "nome": "Jogo de rabicho 240/16/12m", "codigo": "R24016", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "12m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r24054", "nome": "Jogo de rabicho 240/54/3m", "codigo": "R24054", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "3m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r240556", "nome": "Jogo de rabicho 240/56/11m", "codigo": "R240556", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "11m", "numero": null, "tipo": "Rabichos", "status": "em_evento", "eventoAtual": "Pavilhão", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_r24059", "nome": "Jogo de rabicho 240/59/11m", "codigo": "R24059", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "11m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r24060", "nome": "Jogo de rabicho 240/60/13m", "codigo": "R24060", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "13m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_r24063", "nome": "Jogo de rabicho 240/63/5m", "codigo": "R24063", "categoria": "Rabichos", "subcategoria": "rabichos", "bitola": "240", "metragem": "5m", "numero": null, "tipo": "Rabichos", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0823", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0823", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0825", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0825", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0865", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0865", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0922", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0922", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0638", "nome": "Caixa de passagem ?", "codigo": "CX0638", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Shopping Iguatemir", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cx0829", "nome": "Caixa de passagem ?", "codigo": "CX0829", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Shopping Iguatemir", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cx0838", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0838", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0835", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0835", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0837", "nome": "Caixa de passagem 5 barramento com base", "codigo": "CX0837", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Embaixada do Peru", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cx0833", "nome": "Caixa de passagem 4 barramentos", "codigo": "CX0833", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cx0831", "nome": "Caixa de passagem 4 B Neutro lat. N°0831", "codigo": "CX0831", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cd021", "nome": "Caixa de desconexão 400A N°021", "codigo": "CD021", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cd135", "nome": "Caixa de desconexão 400A N°135", "codigo": "CD135", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cd101", "nome": "Caixa de desconexão 400A N°101", "codigo": "CD101", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "Na Praia Festival", "estoqueMin": 1, "estoqueAtual": 0},
  {"id": "mat_cd027", "nome": "Caixa de desconexão 600A N°027", "codigo": "CD027", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cd052", "nome": "Caixa de desconexão 600A N°052", "codigo": "CD052", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cd062", "nome": "Caixa de desconexão 600A N°062", "codigo": "CD062", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cr0866", "nome": "Chave reversora 250A Siemens", "codigo": "CR0866", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cr0906", "nome": "Chave reversora 400A Siemens", "codigo": "CR0906", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_cr0934", "nome": "Chave reversora ?A Siemens", "codigo": "CR0934", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0950", "nome": "QTA 1600A N° Patr. 0950", "codigo": "Q0950", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0867", "nome": "QTA 1000A N° Patr. 0867", "codigo": "Q0867", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0868", "nome": "QTA 1250A N° Patr. 0868", "codigo": "Q0868", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0847", "nome": "QTA 1250A N° Patr. 0847", "codigo": "Q0847", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0848", "nome": "QTA 1600A N° Patr. 0848", "codigo": "Q0848", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0889", "nome": "QTA 1000A N° Patr. 0889", "codigo": "Q0889", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_q0839", "nome": "QTA ATI400A N° Patr. 0839", "codigo": "Q0839", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_j7015", "nome": "Jogo de cabo 70/15/30m", "codigo": "J7015", "categoria": "Jogos de Cabo", "subcategoria": "jogos_de_cabo", "bitola": "70", "metragem": "30m", "numero": null, "tipo": "Jogos de Cabo", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_146", "nome": "Protetor de cabo 5 vias (Verde e amarelo)", "codigo": "146", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "disponivel", "eventoAtual": null, "estoqueMin": 1, "estoqueAtual": 1},
  {"id": "mat_ex2836", "nome": "Extintor de incêncio carga de pó N°2836", "codigo": "EX2836", "categoria": "Outros Materiais", "subcategoria": "outros_materiais", "bitola": null, "metragem": null, "numero": null, "tipo": "Outros Materiais", "status": "em_evento", "eventoAtual": "CICB", "estoqueMin": 1, "estoqueAtual": 0},
]

export async function seedMateriaisReais() {
  const batch = writeBatch(db)
  for (const m of MATERIAIS_REAIS) {
    batch.set(doc(db, 'materiais', m.id), { ...m, criadoEm: serverTimestamp() })
  }
  await batch.commit()
  console.log(`Materiais reais: ${MATERIAIS_REAIS.length} inseridos`)
  return MATERIAIS_REAIS.length
}
const GERADORES_REAIS = [
  { n: 'G01', kva: 180, local: 'JJA 3373' },
  { n: 'G03', kva: 450, local: '***' },
  { n: 'G06', kva: 300, local: '***' },
  { n: 'G10', kva: 115, local: '***' },
  { n: 'G12', kva: 110, local: '***' },
  { n: 'G13', kva: 33, local: '***' },
  { n: 'G14', kva: 33, local: '***' },
  { n: 'G15', kva: 120, local: '***' },
  { n: 'G18', kva: 300, local: '***' },
  { n: 'G19', kva: 300, local: 'JGG 1130' },
  { n: 'G20', kva: 300, local: '***' },
  { n: 'G21', kva: 300, local: '***' },
  { n: 'G23', kva: 165, local: '***' },
  { n: 'G25', kva: 500, local: '***' },
  { n: 'G26', kva: 500, local: '***' },
  { n: 'G27', kva: 300, local: '***' },
  { n: 'G28', kva: 300, local: '***' },
  { n: 'G31', kva: 500, local: '***' },
  { n: 'G32', kva: 500, local: '***' },
  { n: 'G35', kva: 110, local: '***' },
  { n: 'G38', kva: 500, local: '***' },
  { n: 'G39', kva: 500, local: '***' },
  { n: 'G40', kva: 750, local: '***' },
  { n: 'G41', kva: 750, local: '***' },
  { n: 'G42', kva: 500, local: '***' },
  { n: 'G43', kva: 500, local: '***' },
  { n: 'G44', kva: 500, local: '***' },
  { n: 'G45', kva: 500, local: '***' },
  { n: 'G46', kva: 500, local: '***' },
  { n: 'G47', kva: 500, local: '***' },
  { n: 'G48', kva: 500, local: '***' },
  { n: 'G49', kva: 500, local: '***' },
  { n: 'G50', kva: 300, local: '***' },
  { n: 'G51', kva: 120, local: '***' },
  { n: 'G52', kva: 100, local: '***' },
  { n: 'G54', kva: 120, local: '***' },
  { n: 'G55', kva: 220, local: '***' },
  { n: 'G56', kva: 220, local: '***' },
  { n: 'G57', kva: 220, local: '***' },
  { n: 'G58', kva: 170, local: '***' },
  { n: 'G59', kva: 170, local: '***' },
  { n: 'G60', kva: 170, local: '***' },
  { n: 'G61', kva: 81, local: '***' },
  { n: 'G62', kva: 81, local: '***' },
  { n: 'G63', kva: 170, local: '***' },
  { n: 'G64', kva: 220, local: '***' },
  { n: 'G66', kva: 50, local: '***' },
  { n: 'G67', kva: 220, local: '***' },
  { n: 'G69', kva: 180, local: '***' },
  { n: 'G70', kva: 550, local: 'PARÁ' },
  { n: 'G71', kva: 550, local: '***' },
  { n: 'G72', kva: 550, local: '***' },
  { n: 'G73', kva: 550, local: 'PARÁ' },
  { n: 'G74', kva: 550, local: 'PARÁ' },
  { n: 'G75', kva: 550, local: 'PARÁ' },
  { n: 'G76', kva: 250, local: 'JGS 4626' },
  { n: 'G77', kva: 250, local: '***' },
  { n: 'G78', kva: 250, local: '***' },
  { n: 'G79', kva: 250, local: '***' },
  { n: 'G80', kva: 320, local: '***' },
  { n: 'G81', kva: 700, local: '***' },
  { n: 'G82', kva: 700, local: '***' },
  { n: 'G83', kva: 700, local: 'NA PRAIA' },
  { n: 'G84', kva: 120, local: '***' },
  { n: 'G85', kva: 300, local: '***' },
  { n: 'G86', kva: 300, local: '***' },
  { n: 'G87', kva: 300, local: '***' },
  { n: 'G88', kva: 300, local: '***' },
  { n: 'G89', kva: 300, local: 'PARÁ' },
  { n: 'G90', kva: 300, local: '***' },
  { n: 'G91', kva: 300, local: 'PARÁ' },
  { n: 'G92', kva: 300, local: '***' },
  { n: 'G93', kva: 300, local: '***' },
  { n: 'G94', kva: 300, local: '***' },
  { n: 'G95', kva: 125, local: '***' },
  { n: 'G96', kva: 125, local: '***' },
  { n: 'G97', kva: 125, local: '***' },
  { n: 'G98', kva: 360, local: '***' },
  { n: 'G99', kva: 360, local: '***' },
  { n: 'G100', kva: 360, local: '***' },
  { n: 'G101', kva: 360, local: '***' },
  { n: 'G102', kva: 360, local: '***' },
  { n: 'G103', kva: 360, local: '***' },
  { n: 'G104', kva: 360, local: '***' },
  { n: 'G105', kva: 360, local: '***' },
  { n: 'G106', kva: 360, local: '***' },
  { n: 'G107', kva: 360, local: '***' },
  { n: 'G108', kva: 360, local: '***' },
  { n: 'G109', kva: 360, local: '***' },
]

const GG_TECH = {
  1: { marca: 'Stemac', motor: 'MWM', alternador: 'WEG', painel: 'Analógico', ano: 1999, cor: 'Branco', peso: '2.000kg', numSerie: '18005399' },
  3: { marca: 'Stemac', motor: 'Cummins', alternador: 'WEG', painel: 'Analógico', ano: 2000, cor: 'Preto', peso: null, numSerie: '45019800' },
  6: { marca: 'SDMO', motor: 'John Deere', alternador: 'WEG', painel: 'Analógico', ano: 2001, cor: 'Amarelo', peso: null, numSerie: '0115802G001' },
  10: { marca: 'SDMO', motor: 'Perkins', alternador: 'WEG', painel: 'Analógico', ano: 2003, cor: 'Branco', peso: null, numSerie: null },
  12: { marca: 'Olympian', motor: 'Scania', alternador: 'WEG', painel: 'Analógico', ano: 2001, cor: 'Amarelo', peso: null, numSerie: null },
  13: { marca: 'Olympian', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Analógico', ano: 2001, cor: 'Amarelo', peso: null, numSerie: 'OLY00000VRPT00566' },
  14: { marca: 'Olympian', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Analógico', ano: 2001, cor: 'Amarelo', peso: null, numSerie: 'OLY00000ARPT00567' },
  15: { marca: 'Olympian', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Analógico', ano: 2001, cor: 'Amarelo', peso: null, numSerie: 'OLY00000CRPT00588' },
  18: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2007, cor: 'Preto', peso: null, numSerie: 'FGWSCA01KBSS01177' },
  19: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Analógico', ano: 2007, cor: 'Preto', peso: null, numSerie: 'FGWSCA01JBSS01178' },
  20: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWSCA02ES9L00107' },
  21: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWSCA02CS9L00108' },
  23: { marca: 'FG Wilson', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWPEP05HBPT00504' },
  25: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWSCA01LBSS01266' },
  26: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWSCA01HBSS01267' },
  27: { marca: 'FG Wilson', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWPEPP6HBA400720' },
  28: { marca: 'FG Wilson', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Digital', ano: 2008, cor: 'Preto', peso: null, numSerie: 'FGWPEPP6EBA400721' },
  31: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2009, cor: 'Preto', peso: null, numSerie: 'FGWSCA01CBSS01442' },
  32: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2009, cor: 'Preto', peso: null, numSerie: 'FGWSCA01ABSS01444' },
  38: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01JBSS01665' },
  39: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: null },
  40: { marca: 'FG Wilson', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWBPES4JBA900450' },
  41: { marca: 'FG Wilson', motor: 'Perkins', alternador: 'Frame WDG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWBPES4ABA900453' },
  42: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01LBSS01686' },
  43: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01EBSS01691' },
  44: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: null },
  45: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01TBSS01693' },
  46: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: null },
  47: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01CBSS01697' },
  48: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01VBSS01698' },
  49: { marca: 'FG Wilson', motor: 'Scania', alternador: 'WEG', painel: 'Digital', ano: 2010, cor: 'Preto', peso: null, numSerie: 'FGWSCA01ABSS01699' },
  51: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'B13G04409' },
  52: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'B13G04410' },
  54: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'B13G04415' },
  55: { marca: 'Integgral', motor: 'Perkins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: null },
  56: { marca: 'Integgral', motor: 'Perkins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: null },
  57: { marca: 'Integgral', motor: 'Perkins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: null },
  58: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'C13G04370' },
  59: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'C13G04424' },
  60: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'C13G04373' },
  61: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'K12G04121' },
  62: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'J12G04143' },
  63: { marca: 'Integgral', motor: 'Cummins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'D13G04394' },
  64: { marca: 'Integgral', motor: 'Perkins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'B11G40413' },
  67: { marca: 'Integgral', motor: 'Perkins', alternador: 'WEG', painel: 'Digital', ano: 2013, cor: 'Branco', peso: null, numSerie: 'B25G61013' },
  69: { marca: 'Stemac', motor: 'MWM', alternador: 'Gramaco', painel: 'Analógico', ano: 2012, cor: 'Branco', peso: null, numSerie: '180024712' },
  70: { marca: 'Scania', motor: 'Scania DC13072A', alternador: 'WEG GTA312A11B', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '4.350kg', numSerie: '8729387' },
  72: { marca: 'Scania', motor: 'Scania DC13072A', alternador: 'WEG GTA312A11B', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '4.350kg', numSerie: '8729375' },
  73: { marca: 'Scania', motor: 'Scania DC13072A', alternador: 'WEG GTA312A11B', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '4.350kg', numSerie: '8729371' },
  74: { marca: 'Scania', motor: 'Scania DC13072A', alternador: 'WEG GTA312A11B', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '4.350kg', numSerie: '8729386' },
  75: { marca: 'Scania', motor: 'Scania DC13072A', alternador: 'WEG GTA312A11B', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '4.350kg', numSerie: '8729370' },
  76: { marca: 'Max Trust', motor: 'FPT NEF67TE5', alternador: 'WEG AG10250SI20AI', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '2.800kg', numSerie: '6135187' },
  77: { marca: 'Max Trust', motor: 'FPT NEF67TE5', alternador: 'WEG AG10250SI20AI', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '2.800kg', numSerie: null },
  78: { marca: 'Max Trust', motor: 'FPT NEF67TE5', alternador: 'WEG AG10250SI20AI', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '2.800kg', numSerie: '6135932' },
  79: { marca: 'Max Trust', motor: 'FPT NEF67TE5', alternador: 'WEG AG10250SI20AI', painel: 'Digital', ano: 2015, cor: 'Branco', peso: '2.800kg', numSerie: '6135196' },
  80: { marca: 'Scania', motor: 'Scania DC9072A', alternador: 'WEG GTA252A144', painel: 'Analógico', ano: 2013, cor: 'Branco', peso: '3.751kg', numSerie: '8723414' },
  82: { marca: 'Volvo', motor: 'Volvo TAD 1642 GE', alternador: 'GTA 312 AIIB', painel: 'Analógico', ano: 2017, cor: 'Branco', peso: '5.000kg', numSerie: '1853' },
}

export async function seedGeradoresReais() {
  const batch = writeBatch(db)
  for (const entry of GERADORES_REAIS) {
    const num = parseInt(entry.n.replace(/\D/g, ''), 10)
    const id = `gg${String(num).padStart(3, '0')}`
    const codigo = `GG-${String(num).padStart(3, '0')}`
    const potencia = `${entry.kva}kVA`
    const localStr = (entry.local || '').trim()
    const isPlaca = /^[A-Z]{3}\s\d{4}$/.test(localStr)
    const placa = isPlaca ? localStr : null
    let localizacao = 'Pátio SOS'
    if (localStr === 'PARÁ') localizacao = 'Pará'
    else if (localStr === 'NA PRAIA') localizacao = 'Na Praia'
    const tech = GG_TECH[num] || {}
    batch.set(doc(db, 'geradores', id), {
      codigo, potencia, placa, localizacao,
      marca: tech.marca || '', modelo: '', ano: tech.ano || null,
      motor: tech.motor || '', alternador: tech.alternador || '',
      painel: tech.painel || '', cor: tech.cor || '',
      peso: tech.peso || null, numSerie: tech.numSerie || null,
      status: 'disponivel', horimetroAtual: 0,
      temDefeito: false, defeito: '', eventoAtual: null,
      ativo: true, criadoEm: serverTimestamp(),
    })
  }
  await batch.commit()
  console.log(`Geradores reais: ${GERADORES_REAIS.length} inseridos`)
  return GERADORES_REAIS.length
}

const CAT_PARA_OUTROS = ['Caixas de Passagem', 'Caixas de Desconexão', 'Chaves Reversoras', 'QTAs']

export async function fixCategoriasReais() {
  const snap = await getDocs(collection(db, 'materiais'))
  const batch = writeBatch(db)
  let count = 0
  snap.forEach(d => {
    const cat = d.data().categoria
    if (CAT_PARA_OUTROS.includes(cat)) {
      batch.update(d.ref, { categoria: 'Outros Materiais', subcategoria: 'outros_materiais', tipo: 'Outros Materiais' })
      count++
    }
  })
  if (count > 0) await batch.commit()
  console.log(`Categorias corrigidas: ${count} documentos`)
  return count
}

const IDS_VALIDOS = new Set(
  GERADORES_REAIS.map(entry => {
    const num = parseInt(entry.n.replace(/\D/g, ''), 10)
    return `gg${String(num).padStart(3, '0')}`
  })
)

export async function fixGeradoresReais() {
  const snap = await getDocs(collection(db, 'geradores'))
  let count = 0
  for (const d of snap.docs) {
    if (!IDS_VALIDOS.has(d.id)) {
      await deleteDoc(d.ref)
      count++
    }
  }
  console.log(`Geradores removidos: ${count}`)
  return count
}
