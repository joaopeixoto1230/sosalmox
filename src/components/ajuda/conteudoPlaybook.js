// Conteúdo do Playbook do Almoxarifado.
//
// Fica em DADOS, não em JSX, porque a mesma fonte alimenta duas saídas: a tela
// (`Playbook.jsx`) e a versão impressa (`playbookImpresso.js`). Escrever o texto
// direto no JSX obrigaria a manter duas cópias, e a impressa envelheceria calada.
//
// Linguagem: o leitor é o almoxarife, o operador e o mecânico — não o
// programador. Frase curta, palavra do dia a dia, nada de jargão de sistema.

export const VERSAO = '1.0'

/**
 * Blocos aceitos em cada seção:
 *  { p: 'texto' }                          parágrafo
 *  { passos: ['...', '...'] }              lista numerada (o passo a passo)
 *  { lista: ['...', '...'] }               lista com marcador
 *  { atencao: 'texto' }                    caixa de atenção (o que dá problema)
 *  { dica: 'texto' }                       caixa de dica
 *  { tabela: { cabecalho: [], linhas: [] } }
 */
export const SECOES = [
  {
    id: 'entrar',
    titulo: 'Entrando no sistema',
    blocos: [
      { p: 'O sistema abre no navegador, sem instalar nada. Funciona no computador e no celular.' },
      {
        passos: [
          'Aponte a câmera do celular para o QR Code colado no almoxarifado e na oficina.',
          'Entre com o seu e-mail e a sua senha.',
          'Pronto. Da próxima vez o celular já lembra o endereço.',
        ],
      },
      {
        dica: 'No celular, use "Adicionar à tela de início" no menu do navegador. '
          + 'O sistema vira um ícone, igual a um aplicativo.',
      },
      {
        p: 'Cada pessoa vê só as telas do seu trabalho. Se você não encontra um menu '
          + 'que um colega tem, é porque o seu acesso é outro — não é defeito.',
      },
      {
        atencao: 'A senha é sua. Não empreste o login: tudo que é lançado fica registrado '
          + 'com o nome de quem estava logado.',
      },
    ],
  },

  {
    id: 'mapa',
    titulo: 'O que é cada menu',
    blocos: [
      { p: 'Visão rápida do sistema. Cada item tem um capítulo próprio mais adiante.' },
      {
        tabela: {
          cabecalho: ['Menu', 'Para que serve'],
          linhas: [
            ['Dashboard', 'A tela de abertura. Mostra o que precisa de atenção hoje.'],
            ['Saída de Material', 'Registrar material saindo da empresa.'],
            ['Eventos e Locações', 'Ver o que está na rua e o que cada cliente está com.'],
            ['Devolução', 'Registrar material voltando para o almoxarifado.'],
            ['Transferência', 'Mandar material de um evento direto para outro.'],
            ['Estoque', 'Consultar o que tem, cadastrar item, ver o que está acabando.'],
            ['Geradores / Veículos', 'Ficha de cada máquina: onde está, horímetro, histórico.'],
            ['Manutenção', 'Ordens de Serviço: abrir, acompanhar e concluir.'],
            ['Agente IA', 'Assistente que responde perguntas e ajuda a lançar.'],
            ['Relatórios', 'Histórico para consultar e imprimir.'],
          ],
        },
      },
    ],
  },

  {
    id: 'saida',
    titulo: 'Saída de material',
    blocos: [
      { p: 'É o lançamento mais usado. Sempre que material sai da empresa, passa por aqui.' },
      { p: 'A primeira tela pergunta o TIPO da saída. Escolha com atenção, porque muda o resto:' },
      {
        tabela: {
          cabecalho: ['Tipo', 'Quando usar'],
          linhas: [
            ['Evento', 'Show, feira, formatura. Material vai e volta em poucos dias.'],
            ['Locação Mensal', 'Cliente fica com o equipamento por mês, prazo aberto.'],
            ['Sublocação', 'Aluguel para OUTRA empresa, que vem buscar ou recebe na obra.'],
            ['Uso Interno', 'Ferramenta ou material para a própria equipe. Não é cliente.'],
          ],
        },
      },
      { p: 'Escolhido o tipo, são cinco passos, na ordem:' },
      {
        passos: [
          'Evento — nome, local, data, quem leva e a previsão de devolução.',
          'Gerador — quais geradores vão. Pode marcar mais de um, ou nenhum.',
          'Materiais — cabos, caixas e o que mais for junto.',
          'Romaneio — a conferência. Olhe a lista antes de seguir.',
          'Confirmar — fotos, assinaturas e o botão que grava.',
        ],
      },
      {
        dica: 'No passo Materiais existe o botão "Escanear do papel". Tire foto do romaneio '
          + 'escrito à mão e o sistema lê a lista sozinho. Pode fotografar mais de uma folha. '
          + 'Confira o que ele leu antes de seguir — a letra manuscrita às vezes engana.',
      },
      {
        atencao: 'Só clique em Confirmar Saída depois de conferir o romaneio. Depois de gravado, '
          + 'corrigir dá trabalho: precisa mexer no evento, item por item.',
      },
      {
        p: 'Na Sublocação o sistema pede mais coisa: CNPJ da empresa, nome, documento e telefone '
          + 'de quem está retirando. Não é burocracia — é o que garante a cobrança se o material '
          + 'não voltar. O telefone ainda serve para mandar o link de assinatura direto para a pessoa.',
      },
      {
        p: 'Terminada a sublocação, aparece o botão para imprimir a Declaração de Entrega de '
          + 'Material — o documento que a outra empresa assina.',
      },
    ],
  },

  {
    id: 'assinaturas',
    titulo: 'Assinaturas: na tela ou pelo WhatsApp',
    blocos: [
      {
        p: 'Toda saída tem duas assinaturas: de quem entrega (você) e de quem recebe. '
          + 'A de quem recebe pode ser colhida de dois jeitos.',
      },
      {
        lista: [
          'Na hora: a pessoa está no balcão e assina com o dedo, na tela do celular.',
          'Depois: você manda um link e ela assina de onde estiver, pelo celular dela.',
        ],
      },
      {
        p: 'Nenhuma das duas trava a saída. Se a pessoa não está na empresa, confirme a saída '
          + 'normalmente — o material precisa poder sair.',
      },
      {
        passos: [
          'Confirme a saída sem a assinatura de quem recebe.',
          'Na tela de sucesso aparece um quadro amarelo com o link.',
          'Toque em "Enviar pelo WhatsApp" e mande para a pessoa.',
          'Ela abre o link, confere a lista, assina com o dedo e pronto.',
        ],
      },
      {
        dica: 'Na sublocação o WhatsApp já abre na conversa da pessoa que está retirando, '
          + 'porque o telefone dela foi preenchido no começo.',
      },
      {
        p: 'Fechou a tela sem mandar? O link não se perde. Entre em Eventos e Locações, abra o '
          + 'evento e o link estará lá, com os botões Copiar e Enviar no WhatsApp.',
      },
      {
        atencao: 'Saída sem assinatura fica marcada como PENDENTE e aparece no Dashboard todo dia, '
          + 'até alguém assinar. Não é enfeite: sem assinatura, não há como provar quem levou.',
      },
    ],
  },

  {
    id: 'devolucao',
    titulo: 'Devolução',
    blocos: [
      { p: 'Quando o material volta do evento, ele precisa ser devolvido no sistema — senão continua constando como se estivesse na rua.' },
      {
        passos: [
          'Abra Devolução e escolha o evento.',
          'Para cada item, marque como ele voltou: OK, Com problema, Cortado, Perdido ou Parcial.',
          'Item com problema ou cortado pede uma descrição. Escreva o que houve.',
          'Defina o destino dos geradores: voltar ao pátio, ir para outro evento ou ficar em locação.',
          'Toque em Confirmar Devolução.',
        ],
      },
      {
        dica: 'Não lembra em qual evento está o cabo? Na busca, digite o NOME DO MATERIAL '
          + '(ex.: "Cabo 4x50"). O sistema mostra os eventos que estão com ele.',
      },
      {
        p: 'Voltou só uma parte? Não precisa esperar o resto. Marque o status do item e use '
          + '"Lançar só este item". Ele volta para o estoque na hora e o evento continua aberto '
          + 'com o que falta.',
      },
      {
        tabela: {
          cabecalho: ['Status', 'O que acontece com o material'],
          linhas: [
            ['OK', 'Volta para o estoque, disponível.'],
            ['Cortado', 'Volta para o estoque. A descrição fica no histórico.'],
            ['Com problema', 'Vai para manutenção, não fica disponível.'],
            ['Perdido', 'Sai do estoque como perdido.'],
            ['Parcial', 'Ainda falta voltar. Use quando parte do item ficou no evento.'],
          ],
        },
      },
    ],
  },

  {
    id: 'usointerno',
    titulo: 'Uso interno: empréstimo e consumo',
    blocos: [
      { p: 'Para material que fica na empresa. São duas situações diferentes:' },
      {
        lista: [
          'Empréstimo — ferramenta que VOLTA. Furadeira, chave, trena.',
          'Consumo — material que NÃO volta. Fita, parafuso, luva.',
        ],
      },
      {
        p: 'No empréstimo, informe a data prevista de devolução. Passou dessa data, o item aparece '
          + 'no Dashboard como atrasado, com o nome de quem pegou.',
      },
      {
        p: 'Não achou o item na busca? Use "Item não cadastrado" e digite o nome. Ele sai '
          + 'registrado mesmo sem estar no estoque.',
      },
      {
        dica: 'Esses itens digitados à mão ficam guardados na aba "Itens Avulsos", ordenados '
          + 'pelo que mais sai. O que aparece toda semana merece cadastro — tem um botão lá '
          + 'que cadastra de uma vez.',
      },
      {
        p: 'Para devolver a ferramenta: entre em Uso Interno, aba Ferramentas em Campo, e use '
          + 'o botão Devolver no card.',
      },
    ],
  },

  {
    id: 'estoque',
    titulo: 'Estoque',
    blocos: [
      { p: 'O estoque tem duas prateleiras, separadas no topo da tela:' },
      {
        lista: [
          'Materiais de Evento — cabos, caixas, QTAs. O que vai para cliente.',
          'Material Interno — fita, parafuso, EPI, ferramenta. O que a equipe usa.',
        ],
      },
      {
        p: 'Os cartões coloridos do topo são botões. Toque em "Disponíveis" e a lista filtra; '
          + 'toque em "Total de Itens" e ela volta ao normal.',
      },
      {
        p: 'Sobre o alerta de Estoque Baixo: CABO NUNCA aparece nele. Cada cabo é uma unidade, '
          + 'então "1 de 4" com os outros três em evento é operação normal, não falta. '
          + 'O alerta é para o que se compra por quantidade: fita, parafuso, filtro, caixa.',
      },
      {
        atencao: 'Excluir material apaga de vez, e o botão fica no menu ⋯ do card. '
          + 'Na dúvida, não exclua — chame o João.',
      },
    ],
  },

  {
    id: 'filtros',
    titulo: 'Filtros',
    blocos: [
      { p: 'Os filtros ficam organizados por potência de gerador, cada um na sua prateleira.' },
      {
        tabela: {
          cabecalho: ['Botão', 'Quando usar'],
          linhas: [
            ['Entrada', 'Chegou compra nova. Informe a nota e a quantidade.'],
            ['Dar Baixa', 'Usou filtro fora de uma OS.'],
            ['Ajustar estoque', 'A contagem física não bate com o sistema.'],
          ],
        },
      },
      {
        atencao: 'Filtro de mesma referência é UM estoque só, mesmo aparecendo em potências '
          + 'diferentes. Dar baixa em um desconta de todos — está certo, não é erro.',
      },
      {
        p: 'Quando um filtro fica abaixo do mínimo, o sistema abre a solicitação de compra sozinho. '
          + 'Ela vai para a fila em Solicitações.',
      },
    ],
  },

  {
    id: 'manutencao',
    titulo: 'Manutenção (Ordem de Serviço)',
    blocos: [
      { p: 'Toda manutenção de gerador, caminhão ou empilhadeira vira uma OS.' },
      {
        passos: [
          'Em Manutenção, toque em Nova OS.',
          'Escolha o equipamento, se é preventiva ou corretiva, e onde o serviço é feito.',
          'Descreva o serviço e escolha o mecânico.',
          'No passo 2, marque os filtros usados — a baixa no estoque é automática.',
        ],
      },
      {
        p: 'Ao concluir a OS, preencha o relatório do serviço, os problemas encontrados e o '
          + 'horímetro (ou o KM, no caso de veículo). Dá para anexar fotos e colher assinatura.',
      },
      {
        dica: 'A OS concluída gera um relatório em PDF pelo botão Imprimir. O arquivo já sai '
          + 'com o nome certo, ex.: "Relatório Manutenção - GG-045".',
      },
      {
        atencao: 'Gerador que está com cliente NÃO volta para o pátio ao abrir OS — ele fica onde '
          + 'está. Isso é de propósito: o serviço é feito no local.',
      },
      {
        p: 'OS aberta há mais de dois dias aparece no Dashboard como pendência.',
      },
    ],
  },

  {
    id: 'geradores',
    titulo: 'Geradores e veículos',
    blocos: [
      { p: 'Cada máquina tem uma ficha: onde está, horímetro, última manutenção e todo o histórico.' },
      { p: 'O status muda sozinho conforme o movimento — você não precisa ajustar na mão:' },
      {
        tabela: {
          cabecalho: ['Status', 'Significa'],
          linhas: [
            ['Disponível', 'No pátio, pronto para sair.'],
            ['Em Evento', 'Saiu para um evento.'],
            ['Em Locação', 'Com cliente, contrato mensal.'],
            ['Sublocado', 'Alugado para outra empresa.'],
            ['Manutenção', 'Com OS aberta.'],
            ['Defeito', 'Marcado com problema, parado.'],
          ],
        },
      },
      {
        p: 'Na ficha do gerador dá para editar a placa do equipamento: motor, alternador, tensão, '
          + 'frequência e números de série. Se você tirar foto da placa, esses dados podem ser '
          + 'preenchidos.',
      },
    ],
  },

  {
    id: 'agente',
    titulo: 'Agente IA',
    blocos: [
      { p: 'É o assistente do sistema. O botão vermelho no canto da tela abre o chat em qualquer lugar.' },
      { p: 'Ele responde perguntas sobre o que está no sistema, em português comum:' },
      {
        lista: [
          '"Quantos geradores estão disponíveis hoje?"',
          '"Onde está o cabo 4x50 de 28 metros?"',
          '"Qual filtro de óleo do gerador de 110kVA?"',
        ],
      },
      { p: 'E também faz lançamentos, se você pedir:' },
      {
        lista: [
          '"Dá baixa em 2 filtros de ar do 110kVA"',
          '"Abre uma OS corretiva pro GG-15, vazamento de óleo"',
          '"Abre uma saída de material para o evento CCUG"',
        ],
      },
      {
        atencao: 'O agente NUNCA grava nada sozinho. Ele mostra um quadro com o que vai fazer e '
          + 'espera você tocar em Confirmar. Se estiver errado, toque em Cancelar — nada é gravado.',
      },
      {
        dica: 'Existe um botão de microfone: dá para falar em vez de digitar. Útil com a mão suja '
          + 'ou de luva.',
      },
    ],
  },

  {
    id: 'problemas',
    titulo: 'Problemas comuns',
    blocos: [
      {
        tabela: {
          cabecalho: ['Situação', 'O que fazer'],
          linhas: [
            ['A tela não atualizou depois de uma mudança',
              'Puxe a página para baixo para recarregar. No computador, Ctrl+Shift+R.'],
            ['O material não aparece para selecionar na saída',
              'Ele provavelmente já está em outro evento. Confira em Estoque, filtrando por Em Evento.'],
            ['Lancei a saída no evento errado',
              'Não apague. Abra o evento, use "Editar material" para retirar o item e lance de novo no evento certo.'],
            ['A pessoa não recebeu o link de assinatura',
              'Abra o evento em Eventos e Locações e mande de novo pelo botão do WhatsApp.'],
            ['O cabo aparece como estoque baixo',
              'Não deveria. Cabo não entra nesse alerta — se aparecer, avise o João.'],
            ['Esqueci a senha',
              'Fale com o João. Só o administrador redefine acesso.'],
            ['O sistema está lento ou não abre',
              'Confira o sinal de internet. Sem internet o sistema não funciona.'],
          ],
        },
      },
      {
        atencao: 'Nunca lance uma saída "de mentira" para testar. Tudo que é gravado mexe no '
          + 'estoque de verdade. Para tirar dúvida, pergunte ao Agente IA — ele só responde, '
          + 'não altera nada sem confirmação.',
      },
    ],
  },

  {
    id: 'ouro',
    titulo: 'As regras de ouro',
    blocos: [
      {
        lista: [
          'Material que sai é material lançado. Sem lançamento, o estoque mente.',
          'Confira o romaneio ANTES de confirmar. Depois dá trabalho para corrigir.',
          'Material que volta é material devolvido no sistema, no mesmo dia.',
          'Sem assinatura, não há prova de quem levou. Mande o link.',
          'Na dúvida, pergunte ao Agente IA. Ele não estraga nada.',
          'Errou? Avise. Erro escondido vira prejuízo lá na frente.',
        ],
      },
    ],
  },
]
