// Frota inicial transcrita da "Relação de Veículos" (18 veículos).
// Usada uma unica vez pelo botao "Importar frota" da tela de Caminhoes,
// que so aparece para o admin quando a colecao `caminhoes` ainda esta vazia.
// [placa, marca, modelo, observacao, status?, defeito?]
const LINHAS = [
  ['PAI-6453', 'Ford',        '2429',    'Munck Bruno'],
  ['JHZ-8226', 'Ford',        '2422',    'Munck Prata'],
  ['JIL-0122', 'Volkswagen',  '24250',   'Munck Chaguinha'],
  ['JJL-1388', 'Volkswagen',  '',        'Pranchão'],
  ['JGS-4616', 'Volkswagen',  '13180',   'G.20 (caminhão com gerador montado)'],
  ['JGS-4626', 'Volkswagen',  '13180',   '', 'defeito', 'Inoperante'],
  ['JGG-1130', 'Volkswagen',  '13180',   'G.20 (caminhão com gerador montado)'],
  ['JFU-4100', '',            '',        'Abastecimento'],
  ['PBC-3761', '',            '',        'Apoio'],
  ['JGC-3426', 'Volkswagen',  '8.150',   ''],
  ['RCU-5B50', 'Volkswagen',  '',        'Novo'],
  ['JJG-9989', '',            '',        'Pranchinha'],
  ['PBI-4B17', 'Mercedes',    '815',     'Arloc'],
  ['JJB-2067', 'Volkswagen',  '15180',   '500 KVA (caminhão com gerador montado)'],
  ['PBR-5C22', 'Fiat',        'Strada',  ''],
  ['NIY-9593', 'Fiat',        'Fiorino', ''],
  ['JJA-3373', '',            '',        'Chebão GG-001 (caminhão com gerador montado)'],
  ['UIY-9J93', 'Fiat',        'Fiorino', 'Novo'],
]

export const FROTA_INICIAL = LINHAS.map(([placa, marca, modelo, observacao, status, defeito]) => {
  const temDefeito = status === 'defeito'
  return {
    placa,
    marca: marca || '',
    modelo: modelo || '',
    ano: '',
    status: status || 'disponivel',
    localizacao: 'Pátio SOS',
    kmAtual: null,
    semKm: false,
    observacao: observacao || '',
    temDefeito,
    defeito: temDefeito ? (defeito || 'Com defeito') : '',
    eventoAtual: null,
    eventoNome: null,
    ultimaManutencao: null,
    proximaPreventiva: null,
    fotoUrl: null,
    ativo: true,
  }
})
