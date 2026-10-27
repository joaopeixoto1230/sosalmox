// Lista de operadores/colaboradores usada em varios fluxos (Saida de Evento,
// Uso Interno etc.). Centralizada aqui para nao duplicar/divergir entre telas.
export const OPERADORES = [
  'Adjaiton',
  'Adriano Carvalho',
  'Andre França',
  'Bruno Araujo',
  'Fabio Alves',
  'Francisco das Chagas',
  'Gerson Rodrigues',
  'Igor Fernando',
  'João Felipe Peixoto',
  'José Marcio',
  'Laércio Rodrigues',
  'Maycon Teixeira',
  'Maykon Souza',
  'Nilton Fernandes',
  'Ricardo Goudinho',
  'Robson José',
  'Ronaldo Pedrosa',
]

// Quem executa manutenção. Nomes completos, iguais aos de OPERADORES, para a
// mesma pessoa não aparecer como "FABIO" numa tela e "Fabio Alves" em outra.
// OS antigas guardaram o nome curto e continuam exibindo como foram gravadas —
// é histórico, não se reescreve.
export const MECANICOS = [
  'Nilton Fernandes',
  'Fabio Alves',
  'Andre França',
]

// Na conclusão da OS interna, só estes dois assinam como técnico.
export const TECNICOS_CONCLUSAO = ['Andre França', 'Fabio Alves']
