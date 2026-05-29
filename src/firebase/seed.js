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
