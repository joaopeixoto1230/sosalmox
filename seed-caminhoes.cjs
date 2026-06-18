// Seed unico da colecao `caminhoes` a partir da Relacao de Veiculos.
// Idempotente: nao duplica — pula placas que ja existem.
// Rodar uma vez:  node seed-caminhoes.cjs
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// placa, marca, modelo, observacao, status, defeito
const VEICULOS = [
  ['PAI-6453', 'Ford',        '2429',  'Munck Bruno'],
  ['JHZ-8226', 'Ford',        '2422',  'Munck Prata'],
  ['JIL-0122', 'Volkswagen',  '24250', 'Munck Chaguinha'],
  ['JJL-1388', 'Volkswagen',  '',      'Pranchão'],
  ['JGS-4616', 'Volkswagen',  '13180', 'G.20 (caminhão com gerador montado)'],
  ['JGS-4626', 'Volkswagen',  '13180', '', 'defeito', 'Inoperante'],
  ['JGG-1130', 'Volkswagen',  '13180', 'G.20 (caminhão com gerador montado)'],
  ['JFU-4100', '',            '',      'Abastecimento'],
  ['PBC-3761', '',            '',      'Apoio'],
  ['JGC-3426', 'Volkswagen',  '8.150', ''],
  ['RCU-5B50', 'Volkswagen',  '',      'Novo'],
  ['JJG-9989', '',            '',      'Pranchinha'],
  ['PBI-4B17', 'Mercedes',    '815',   'Arloc'],
  ['JJB-2067', 'Volkswagen',  '15180', '500 KVA (caminhão com gerador montado)'],
  ['PBR-5C22', 'Fiat',        'Strada', ''],
  ['NIY-9593', 'Fiat',        'Fiorino', ''],
  ['JJA-3373', '',            '',      'Chebão GG-001 (caminhão com gerador montado)'],
  ['UIY-9J93', 'Fiat',        'Fiorino', 'Novo'],
]

async function main() {
  const snap = await db.collection('caminhoes').get()
  const existentes = new Set(snap.docs.map(d => (d.data().placa || '').toUpperCase()))

  let criados = 0, pulados = 0
  for (const [placa, marca, modelo, observacao, status, defeito] of VEICULOS) {
    if (existentes.has(placa.toUpperCase())) {
      console.log(`- pulado (ja existe): ${placa}`)
      pulados++
      continue
    }
    const temDefeito = status === 'defeito'
    await db.collection('caminhoes').add({
      placa,
      marca: marca || '',
      modelo: modelo || '',
      ano: '',
      status: status || 'disponivel',
      localizacao: 'Pátio SOS',
      horimetroAtual: null,
      semHorimetro: true,
      observacao: observacao || '',
      temDefeito,
      defeito: temDefeito ? (defeito || 'Com defeito') : '',
      eventoAtual: null,
      eventoNome: null,
      ultimaManutencao: null,
      proximaPreventiva: null,
      fotoUrl: null,
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log(`+ criado: ${placa}  ${marca} ${modelo}`.trim())
    criados++
  }
  console.log(`\nConcluido. Criados: ${criados} | Pulados: ${pulados}`)
  process.exit(0)
}

main().catch(err => { console.error('Erro:', err); process.exit(1) })
