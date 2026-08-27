# SOS Almoxarifado — Guia permanente do projeto

> Este arquivo é lido automaticamente pelo Claude Code no início de toda sessão.
> Ele existe para que NUNCA mais se perca trabalho nem contexto entre sessões.

## O que é o sistema

Sistema de almoxarifado da SOS Energia (locação de geradores). Usuário principal: João (admin).
Em produção no Firebase Hosting, projeto `sos-almox`. Usado diariamente pela equipe —
**qualquer funcionalidade removida por engano causa prejuízo real na operação.**

## Stack

- React 19 + Vite 8 + React Router v7
- Tailwind CSS v3 — cores: `brand-red` #CC0000, `brand-black` #0A0A0A, `brand-bg` #F5F5F5
- Classes utilitárias próprias: `card`, `btn-primary`, `btn-secondary`, `btn-ghost`, `input`, `badge`
- Dark mode: `darkMode: 'class'` no tailwind.config.js + overrides em `src/index.css` + script inline no `index.html`
- Firebase v12: Firestore + Auth. Coleções principais: `usuarios`, `materiais`, `eventos`,
  `ordens_saida`, `filtros`, `entradas_filtro`, `baixas_filtro`, `ordens_servico`,
  `geradores`, `solicitacoes_compra`, `contadores`, `conversas_agente`
- Regra de transaction do Firestore: TODAS as leituras antes de TODAS as escritas

## ⛔ REGRAS DE GIT — NUNCA VIOLAR

Hoje (12/06/2026) um rebase para "corrigir commits não verificados" reescreveu o histórico
e apagou um dia inteiro de trabalho (~3.000 linhas). Foi recuperado buscando o commit
órfão por SHA completo no GitHub. Para isso nunca se repetir:

1. **NUNCA fazer rebase do histórico já publicado.** Nem para corrigir autoria, assinatura
   ou hook de verificação. Se o stop hook reclamar de commits antigos não verificados, **ignorar**.
2. Se o hook reclamar **apenas do commit do topo**: pode usar
   `git commit --amend --no-edit --reset-author` seguido de
   `git push --force-with-lease=<branch>:<sha-antigo-exato>`. Nunca mais que o commit do topo.
3. **NUNCA `git reset --hard` para um commit antigo** sem antes anotar o SHA atual do HEAD.
4. Antes de qualquer operação destrutiva, salvar o SHA atual:
   `git log -1 --format=%H` — e informar esse SHA na conversa.
5. **Recuperação de emergência**: o GitHub guarda commits órfãos. Buscar por SHA completo:
   `git fetch origin <sha-completo-de-40-caracteres>` e depois `git reset --hard FETCH_HEAD`.
6. Identidade dos commits: `user.name=Claude`, `user.email=noreply@anthropic.com`.
7. Branch de trabalho: `claude/laughing-carson-FcEmu`. Nunca empurrar para outro branch.
8. Push direto via terminal funciona com PAT na URL:
   `git push https://<PAT>@github.com/joaopeixoto1230/sosalmox.git HEAD:claude/laughing-carson-FcEmu`
9. **Se `git push` devolver `403 Resource not accessible by integration`**: o app do Claude
   não está INSTALADO no repositório (autorizado ≠ instalado). Conferir em
   https://github.com/settings/installations — se o Claude não aparecer lá, instalar por
   https://github.com/apps/claude e marcar o `sosalmox`. A credencial da sessão passa a
   funcionar na hora, sem reabrir a sessão. Enquanto isso, alternativa: `git format-patch`
   e o usuário aplica com `git am` na máquina dele.

## 🛡️ REGRAS DE PRESERVAÇÃO DE FUNCIONALIDADES

Hoje várias funcionalidades sumiram em edições e precisaram ser restauradas uma a uma.
**Antes de editar qualquer arquivo, ler o arquivo inteiro e preservar tudo que já existe.**
Nunca reescrever um componente do zero quando o pedido é só adicionar algo.

Inventário de funcionalidades que JÁ EXISTEM e não podem sumir:

### Filtros (`src/components/filtros/`)
- Cards por potência (30 a 750kVA + Caminhão + Empilhadeira)
- FiltroCard: menu ⋯ com **"Ajustar estoque"** (edição direta da quantidade), Entrada, Baixa
- Botão de migração "+ Filtros 700kVA" (admin, some quando os filtros 700kVA já existem)
- ⚠️ O lançamento de OS ("Saída p/ Manutenção") NÃO fica mais aqui — foi consolidado na
  Nova OS da Manutenção (passo 2 = filtros). Não recriar essa modal nos Filtros.

### Manutenção (`src/components/manutencao/`)
- DetalheOS: **editar OS, excluir OS (devolve filtros ao estoque via transaction e recalcula
  últimaManutencao do GG), imprimir relatório em PDF (`gerarPDF`)**
- **Nome do arquivo ao salvar em PDF** (`utils/impressao.js`, `imprimirComNome`): o navegador
  monta o nome sugerido a partir do `document.title` da PÁGINA, **não** do `<title>` que está
  dentro do iframe — por isso todo relatório saía como "SOS Almoxarifado". O helper troca o
  title só durante a impressão e devolve no `afterprint` (mais um timer de segurança, senão a
  aba fica com o nome do relatório). OS → `Relatório Manutenção - <equipamento>`;
  período → `Relatório de Manutenções - <período>`. Ao criar um relatório novo, usar o helper —
  `/`, `:` e afins são trocados por `-` porque quebram o nome no Mac e no Windows.
- Conclusão de OS com: relatório de serviço, problemas encontrados, próxima preventiva
- Adicionar filtros a OS aberta; baixa automática de filtros na conclusão
- Numeração OS-YYYY-NNN via `contadores/ordens_servico`
- NovaOS em 2 passos: passo 1 = equipamento + local (pátio/locação) + cliente/obra + quem faz
  a manutenção (Nilton/Fabio/França); passo 2 = filtros (baixa de estoque compartilhado, igual
  ao antigo SaidaFiltros). Com filtros a OS nasce `em_andamento` com `origem: 'saida_filtros'`.
- Local pátio/locação: gerador em locação NÃO tem status/localização alterados (fica no cliente).
- Conclusão: fotos do serviço (base64 no Firestore, coleção `fotos_os` — Storage exige Blaze)
  + assinaturas digitais
  (técnico sempre; cliente opcional só em locação) salvas como imagem no doc da OS, no PDF e na tela.

### Patrimônio (`src/components/patrimonio/`)
- GG-001 a GG-107 + caminhões + empilhadeiras; status automático por evento/OS/devolução
- Status "Em Locação" e "Sublocado"; edição de horímetro e opção "sem horímetro"
- Edição de gerador liberada para almoxarife e mecânico
- DetalheGG: edição inclui a **Ficha técnica (placas)** — motor, alternador, tensão,
  frequência, fator de potência e números de série (antes os campos só eram exibidos).
- O GG-015 foi atualizado com os dados das placas físicas (BRG Geradores SLIM 110, 110kVA)
  via botão de migração temporário, já aplicado e removido do código em 27/08/2026.

### Saída de Material (`src/components/saida/`)
- Passo inicial **Tipo de Saída** com QUATRO cards (grade 2×2). Não remover o seletor:
  **Evento** (fluxo de 5 passos — evento, multi-gerador, romaneio, confirmação com assinaturas),
  **Locação Mensal**, **Sublocação** (ver abaixo) e **Uso Interno**.
- **Locação Mensal** e **Sublocação** usam o MESMO fluxo de 5 passos do Evento. O que muda é o
  vocabulário do passo 1, quem preenche o campo de quem recebe e o status do gerador.
  - Ambas gravam em `eventos` com o campo `tipo` (`locacao_mensal` / `sublocacao`). Documento
    SEM o campo `tipo` continua contando como Evento — mesma convenção do `tipo` em
    `ordens_saida` (uso interno). **Não migrar dados.**
  - Gerador: Evento → `em_evento`; Locação Mensal → `locacao` (roxo); Sublocação → `sublocado`
    (verde-azulado). `ESTADOS_ACOMPANHA` em formatters inclui os três, para o caminhão com
    gerador montado acompanhar.
  - **Sublocação** = aluguel para OUTRA empresa. Quem retira é de fora, então o campo "Quem está
    retirando" é **texto livre** (nunca a lista de OPERADORES). Esse nome já alimenta a assinatura
    de quem recebeu, o link `/assinar/:token` e o relatório — não redigitar em lugar nenhum.
    - **Obrigatórios na sublocação** (e só nela): CNPJ da empresa, documento e telefone de quem
      retira, e a **assinatura de quem recebeu** — o botão Confirmar fica travado sem ela.
      Regra do João: a pessoa assina antes de sair da empresa. Não afrouxar sem falar com ele.
    - **Declaração de Entrega de Material** (`utils/declaracaoSublocacao.js`): documento que a
      outra empresa assina, com timbre, itens agrupados, cláusula de conservação e as duas
      assinaturas. Sai na tela de sucesso da saída e no detalhe da sublocação. Os dados da SOS
      ficam em `utils/empresa.js`; sem razão social e CNPJ o botão avisa em vez de gerar.
  - ⚠️ O MATERIAL continua com status `em_evento` nas três modalidades. A devolução tem
    `if (statusAtualMat[item.id] !== 'em_evento') continue` — um status novo faria os itens
    serem pulados em silêncio e nunca voltarem ao estoque. A separação é no gerador, na aba
    Eventos e no card do Estoque.
  - Patrimônio tem card e filtro "Sublocados"; GGCard permite a troca manual pedindo o destino.
- **Previsão de devolução** — SÓ no fluxo de Evento (locação e sublocação ficam com o cliente
  por prazo indeterminado). Campo obrigatório no passo 1, gravado em `previsaoDevolucao` no
  doc de `eventos` e na `ordens_saida`. Sugere a **próxima segunda-feira** (`proximaSegunda`),
  porque o evento é no fim de semana e o material volta na segunda. Sempre editável.
  - ⚠️ **NUNCA estimar a previsão a partir do campo `data`.** `data` guarda o dia em que a SAÍDA
    foi lançada, não o dia do evento — o evento acontece depois. A primeira versão estimava
    `data + 1 dia` e acusou atraso em 11 de 11 eventos que estavam no prazo.
    Sem `previsaoDevolucao` preenchida, **não há cobrança** (`previsaoDoEvento` devolve null).
- **Escanear do papel** (`ScanPapelModal` + `utils/scanRomaneio.js`): lê romaneio manuscrito por
  foto via Claude Sonnet (visão), aceita **múltiplas fotos**, casa com o estoque, cadastra item na
  hora e cai na conferência. Fotos comprimidas antes de enviar; input SEM `capture` (galeria+câmera).
- `StepConfirmacao`: grava `ordens_saida` via transaction, fotos base64 em `fotos_saida`,
  assinaturas com link público (`/assinar/:token`, coleção `assinaturas_saida`). O estado de erro
  mostra a mensagem (NÃO voltar ao `return null` que dava tela preta).

### Uso Interno (`src/components/saida/usointerno/` + `src/components/usointerno/`)
Saídas internas sem vínculo a evento. Gravadas em `ordens_saida` com `tipo:'uso_interno'`
(histórico unificado com Evento — ordens sem `tipo` = Evento). Dois subtipos:
- **Empréstimo** (ferramenta que volta): responsável, itens, `dataPrevistaDevolucao`,
  `destinoMotivo`, `statusEmprestimo` (`pendente`→`devolvido`/`parcial`). Item cadastrado vira
  status **`emprestado`**. A devolução é gravada no bloco `devolucao` do PRÓPRIO doc (status
  `ok`/`problema`/`nao_devolvido` + transições: ok→disponível, problema→manutenção, não devolvido→
  perdido). NÃO cria doc em `devolucoes`.
- **Consumo** (não volta): responsável, itens+qtd, `motivo`. Item cadastrado → baixa definitiva
  status **`consumido`**.
- **Item avulso** (`avulso:true`): nome livre + quantidade + unidade, NÃO mexe em estoque.
- View **`/uso-interno`** (módulo `USO_INTERNO`): aba "Ferramentas em Campo" (pendentes, mais
  atrasado primeiro, devolver, fotos saída/devolução) e "Itens Avulsos" (agrupa por nome/frequência).
- **"Cadastrar no estoque"** na aba Itens Avulsos (`CadastrarAvulsosModal.jsx`): transforma o
  item avulso em material de verdade no grupo `uso_interno`. Sugere categoria e código pelo
  nome (`sugestaoCadastro.js`, com testes), bloqueia o que já tem material de mesmo nome e só
  grava com confirmação. `writeBatch` em lotes de 400.
- **Baixa por QUANTIDADE dos consumíveis** (`estoque/contagem.js`, testes em `contagem.test.js`
  incluindo o ciclo completo saída → devolução → exclusão). O resto do sistema trata
  1 documento = 1 unidade (cada cabo é um doc, a saída zera o doc). Isso serve para cabo e
  ferramenta, não para fita e parafuso, que saem em quantidade do MESMO doc.
  - `materialContado(m)`: o campo **`porQuantidade: true`** (checkbox "Controlado por
    quantidade" no cadastro e na edição do material) vale em QUALQUER grupo — é assim que o
    **alambrado de proteção**, que é material de EVENTO, sai por quantidade. Sem o marcador,
    conta por categoria só dentro do grupo `uso_interno` (Fitas/Fixação/EPI/Consumíveis, ou
    quem tem mais de 1). Material de evento **sem o marcador não muda em nada**.
    "Protetor de cabo" segue de fora (regra própria, não mexe em estoque).
  - Fluxo de EVENTO: `patchSaidaEvento` desconta e **não** marca `em_evento` nem `eventoAtual`
    no contado — prender o doc tiraria o resto da prateleira. `patchDevolucaoEvento` devolve a
    quantidade só em ok/cortado (perdido e danificado não voltam).
    - ⚠️ A devolução de evento pula item que não está `em_evento`; o contado **nunca** fica
      `em_evento`, então cairia nesse buraco calado. O `if` só se aplica a material de unidade.
    - ⚠️ Material que já estava `em_evento` saiu pela regra antiga: `patchDevolucaoEvento`
      detecta isso e devolve inteiro, senão ficaria preso em `em_evento` para sempre.
  - ⚠️ **O contado NÃO tem `eventoAtual`** — o vínculo dele com o evento são os itens da
    ordem de saída, com a quantidade. `contadosDoEvento(ordens, materiais)` é o único jeito
    de achá-lo. Toda tela que devolve material ao fim do evento passa por lá: **concluir
    evento, excluir evento e editar material do evento** (`Eventos.jsx`). Quem procurar só
    por `where('eventoAtual','==',id)` deixa a quantidade fora da prateleira para sempre.
    Na exclusão, devolver ANTES de apagar as ordens — a quantidade só existe lá.
  - Editar material do evento: o contado tem campo de quantidade ao adicionar, mostra
    "N no evento" e continua na lista de disponíveis enquanto sobra estoque (dá para mandar
    mais depois). Adicionar grava o item na ordem de saída; sem isso a devolução não teria
    de onde saber quanto devolver.
  - `patchSaida` desconta e **só troca de status ao zerar**: senão a fita sumiria dos
    disponíveis tendo ainda 17 rolos. `patchEstorno` soma de volta a quantidade que saiu.
  - ⚠️ Aplicado nos QUATRO pontos que mexem no material: saída (`UsoInternoFlow`), adicionar
    itens a empréstimo aberto, devolução e excluir lançamento (`UsoInternoView`). Faltar um
    deles faz a conta desandar em silêncio. Na exclusão, item contado NÃO pode depender do
    status esperado (`consumido`/`emprestado`), porque ele fica `disponivel` enquanto sobra.
  - ⚠️ `materialPorQuantidade` (formatters) é usado em 15 lugares do fluxo de EVENTO —
    não alterar. `materialContado` é conceito separado, só do Uso Interno.
- Fotos são por ORDEM (base64 em `fotos_saida`, campo `momento:'saida'|'devolucao'`), não por item.
- Status de material novos: `emprestado`, `consumido` (em `utils/formatters` e nas pills do Estoque).
- **Assinaturas** iguais à externa: entregou/recebeu no fluxo + link `/assinar/:token`
  (doc em `assinaturas_saida`, campo `tokenAssinatura`/`assinaturaStatus` na ordem).
- **Relatório imprimível** (`utils/relatorioUsoInterno.js`): usado na tela de sucesso do fluxo e
  na aba Histórico (busca as imagens de assinatura pelo token).
- Aba **Histórico** na view `/uso-interno`: todas as saídas internas, com imprimir relatório e
  **excluir lançamento** (transaction: devolve ao estoque só itens ainda `emprestado`/`consumido`
  daquela ordem, apaga o doc de assinatura e as fotos da ordem).
- **Anexar à saída do dia**: se o mesmo responsável já tem saída do mesmo subtipo HOJE
  (empréstimo ainda pendente), o fluxo oferece anexar os itens à ordem existente (checkbox) em vez
  de criar ordem nova — atualiza `itens` da ordem E do doc de assinatura. `criadoEm` pendente
  (serverTimestamp não confirmado) conta como hoje.
- Botão **"+ Itens"** nos cards de Ferramentas em Campo (`AdicionarItensModal`): adiciona
  cadastrado/avulso direto a um empréstimo pendente, mesma transaction do anexar.
- O relatório espera as imagens decodificarem (`img.decode()`) antes do `print()` — senão as
  fotos JPEG saem em branco no PDF. Não voltar ao `win.print()` imediato.

### Estoque (`src/components/estoque/`)
- **Dois grupos de estoque** (campo `grupo` no doc de `materiais`): `eventos` (padrão —
  doc SEM o campo conta como eventos, sem migração) e `uso_interno` (ferramental, fitas,
  parafusos, EPI, consumíveis). Seletor segmentado no topo da tela; estatísticas, abas de
  categoria, pills de status e grid todos escopados ao grupo selecionado.
  - ⚠️ O grupo `uso_interno` aparece na tela como **"Material Interno"**. Só o RÓTULO mudou;
    o valor gravado segue `uso_interno`. O nome é diferente de propósito, para não confundir
    com a tela de **Uso Interno** (empréstimos e consumo), que é outra coisa.
- Constantes compartilhadas em `src/components/estoque/categorias.js`
  (GRUPOS, CATEGORIAS_POR_GRUPO, TIPOS_POR_CATEGORIA, categoriasDoGrupo, grupoDoMaterial) —
  usadas por Estoque, NovoMaterialModal e ModalEditarMaterial. Não recriar constantes locais.
- Cards de estatística CLICÁVEIS (filtram por status; Estoque Baixo alterna o checkbox;
  Total limpa filtros). No grupo uso_interno o 3º card vira "Emprestados".
- **Estoque baixo é por ESPÉCIE, não por documento** (`estoque/estoqueEspecie.js`, coberto
  por `estoqueEspecie.test.js` — rodar `npm test` antes de mexer). Cada cabo é um doc de
  uma unidade (1/1); a regra antiga `estoqueAtual <= estoqueMin` marcava TODO cabo parado
  no pátio como baixo (290 de 290 itens). Agora:
  - Espécie = categoria + bitola normalizada ("35mm²" = "35"); o comprimento NÃO separa.
    Sem bitola, agrupa pelo tipo. Perdido/consumido saem do acervo.
  - Alerta se: 0 disponíveis; OU sobrou 1 tendo mais de 1 no acervo; OU ≤20% do total.
    Bitola de unidade única parada no pátio NÃO alerta (regra do João: "se está na
    empresa, não é estoque baixo").
  - Consumíveis (protetor de cabo, fita, parafuso — `materialPorUnidade` = false) mantêm
    a regra clássica estoqueAtual/estoqueMin. Não unificar as duas regras.
  - O card mostra "X de Y" da bitola no lugar do antigo 1/1; o card de estatística conta
    bitolas/tipos em falta, não itens.
- Categorias extras criadas pelo usuário são derivadas dos materiais DO MESMO grupo.
- NovoMaterialModal e ModalEditarMaterial têm o seletor de grupo (mover material de grupo
  na edição é permitido); "+ Nova categoria…" continua nos dois grupos.
- **Mover em lote** (`MoverGrupoModal.jsx` + botão "Mover itens de grupo" no topo do Estoque):
  o grupo Material Interno nasceu DEPOIS do estoque, então fita, parafuso e EPI foram
  cadastrados em "Outros Materiais", que é categoria do grupo de eventos — e a aba Material
  Interno ficou vazia. A modal pré-marca o que parece uso interno (`sugestaoGrupo.js`, com
  testes em `sugestaoGrupo.test.js`) mas **quem confirma é o usuário**: nada se move sozinho.
  - Só o campo `grupo` muda. Status, quantidade e `eventoAtual` ficam intactos — é mudança de
    prateleira, não movimentação de estoque —, por isso é reversível movendo de volta.
  - `writeBatch` em lotes de 400 (o limite do Firestore é 500 operações por batch).
  - ⚠️ A pré-marcação NUNCA pode pegar cabo: são centenas de docs e o estrago seria grande.
    O teste cobre isso explicitamente ("NÃO marca material de evento de verdade").

### Eventos e Locações (`src/components/eventos/Eventos.jsx`)
- ⚠️ **UM componente, DUAS portas do menu.** `/eventos` e `/locacoes` renderizam o MESMO
  `Eventos`, com `filtroInicial` diferente. Nunca duplicar essa tela: ela tem detalhe com
  histórico, fotos, assinaturas (link e coleta presencial), relatório impresso, concluir e
  excluir em cascata. Duas cópias = correção que só entra numa delas.
  - As rotas usam `key` (`key="eventos"` / `key="locacoes"`). SEM isso o React reaproveita a
    instância ao trocar de porta e o filtro da tela anterior fica preso.
  - Botões de filtro mudam por porta (`FILTROS_PORTA`): Tudo/Eventos/Locações em `/eventos`;
    Todas/Mensais/Sublocações em `/locacoes`. Título, subtítulo, vazio e botão vêm de `TITULOS`.
  - `daCategoria`: 'evento' = documento SEM `tipo`; 'locacoes' = mensal + sublocação.
- **Converter modalidade** na edição do evento (seletor Modalidade). A conversão move junto,
  por batch, os geradores presos àquele evento para o status correspondente
  (`STATUS_GG_POR_TIPO`) — sem isso a frota mostraria "Em Evento" para uma locação.
  Evento é gravado como `tipo: null` (a ausência do campo é a convenção; null desfaz conversão).
- A previsão de devolução também é editável aqui, só quando a modalidade é Evento.
- Menu ⋯: editar, editar material, editar geradores, encerrar/concluir e excluir.

### Painel / Dashboard (`src/components/dashboard/`)
- Ordem da tela: **pendências → números → roscas → frota → agenda → atalhos**.
- `pendencias.js` (com testes em `pendencias.test.js` — rodar `npm test` antes de mexer):
  material a cobrar, OS parada >2 dias, ferramenta emprestada em atraso, saída sem assinatura
  de quem recebeu e solicitação de compra na fila.
  - Cada pendência declara o **MÓDULO** a que pertence e o painel filtra por `temPermissao`:
    ninguém recebe alerta que não consegue resolver. A faixa some por completo quando não há nada.
- `Rosca.jsx` + `cores.js`: roscas de saídas por tipo, frota e preventiva × corretiva.
  - **Clique na fatia leva ao recorte filtrado**, não só à tela. O link é montado pela mesma
    função que LÊ o parâmetro do outro lado (`linkDoGrupo`/`grupoPorChave` em
    `patrimonio/gruposFrota.js`; `linkDoTipo`/`tipoDaURL` em `manutencao/filtrosURL.js`),
    com teste de ida e volta nos dois — link escrito à mão no painel abriria a lista inteira
    calado se alguém digitasse `emUso` no lugar de `emuso`. Ao criar fatia nova, usar o helper.
  - `GRUPOS_FROTA` mora em `patrimonio/gruposFrota.js` (não no Dashboard): a tela de Geradores
    usa a MESMA lista ao receber `?grupo=`. A frota filtra um status por vez e o grupo junta
    vários, por isso o recorte vive à parte no Patrimônio, com aviso na tela e "Ver a frota
    toda"; clicar em qualquer status sai do recorte (os dois juntos dariam lista vazia).
  - ⚠️ A paleta foi verificada para daltonismo. **Roxo e azul ficam indistinguíveis** para
    daltônicos se aproximados — por isso a frota vai em 3 grupos (prontos / em uso /
    indisponíveis) e não nos 6 status. Trocar tom exige refazer a verificação.
  - Sem rótulo dentro da fatia: em fatia estreita o texto estoura o anel; a legenda já traz
    valor e percentual.
- Estoque baixo usa a MESMA regra da aba Estoque (`estoqueEspecie`), grupo a grupo e somado.
- O bloco "Configuração inicial de dados" (importar planilhas) é só admin e só aparece quando
  faltam dados. **Não remover** — é a rede de segurança para repopular o banco.
- Cor tem significado: vermelho e âmbar só no que exige ação.
- ⚠️ Fundo tingido precisa da variante `dark:` (o projeto usa `darkMode: 'class'`).
  `bg-red-50/50` sem `dark:` vira cinza lavado no tema escuro. Em SVG, usar
  `fill="currentColor"` + classe `text-*`: os overrides do tema agem sobre `text-`, não `fill-`.

### Outros
- Devolução (Evento), transferência, estoque com filtro de status em pills coloridas
- Compras: fila de solicitações, nova solicitação manual
- Agente IA (Claude Haiku via `VITE_ANTHROPIC_API_KEY`), botão flutuante em todas as telas
- Dark mode com toggle no header
- Relatórios com abas Saídas / Devoluções / Condições

## 🖼️ Logo e identidade visual

- Logo oficial: `public/logo-sos-v2.png` (SOS vermelho com raio no O, fundo transparente, 798×331)
- Favicon: `public/favicon-v2.png` e `public/favicon.ico`
- **Os arquivos têm sufixo `-v2` de propósito (cache busting). Se trocar a imagem de novo,
  renomear para `-v3` etc. e atualizar Sidebar.jsx, LoginPage.jsx e index.html** —
  senão o usuário continua vendo a versão antiga em cache.

## 🚀 Deploy (sempre na máquina do usuário)

> ⛔ **NUNCA rodar `npm run build` + deploy do servidor remoto.** Em 09/08/2026 isso
> derrubou o sistema em produção. O `.env` com as chaves do Firebase existe SÓ na máquina
> do João — o repositório tem apenas o `.env.example`. Sem ele, o Vite troca
> `VITE_FIREBASE_API_KEY` por `undefined` **sem erro nenhum**, o build "passa", e o app
> publicado quebra ao inicializar o Firebase: tela branca para a equipe inteira.
> O build tem que ser gerado na máquina que tem o `.env`.
> Para conferir um `dist/` antes de publicar: `grep -o "AIzaSy[A-Za-z0-9_-]*" dist/assets/*.js`
> — se não achar nada, o pacote está sem credencial e NÃO pode ir para o ar.
> (Um token `firebase login:ci` dá permissão de publicar, mas não resolve o `.env`.)

O servidor remoto NÃO consegue fazer deploy (rede bloqueia OAuth do Firebase).
Hoje o João usa principalmente o **MacBook**; a máquina Windows ainda existe.

⚠️ **SEMPRE dar o comando já com o `cd` na pasta do projeto** (`~/Projetos/sosalmox`), nunca
"vá até a pasta do projeto". O João copia e cola direto no Terminal; sem o `cd` o comando
roda na Home e falha.

**Mac (uso atual)** — Terminal. O João pede **tudo em um bloco só**, para colar de uma vez.
Ligar com `&&` (no zsh funciona, e assim para no primeiro erro em vez de seguir na pasta errada):

```bash
cd ~/Projetos/sosalmox && ./deploy.sh
```

Sem o script (também em um bloco só):

```bash
cd ~/Projetos/sosalmox && git fetch origin claude/laughing-carson-FcEmu && git reset --hard origin/claude/laughing-carson-FcEmu && npm run build && npx firebase-tools deploy --only hosting --project sos-almox
```

Primeira vez no Mac: `npx firebase-tools login` (abre o navegador — usar a MESMA conta Google
do projeto `sos-almox`). Depois do deploy, orientar **Cmd+Shift+R**.

**Windows** — PowerShell (também com o `cd`, um comando por linha):

```powershell
cd $HOME\sosalmox
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

Os dois scripts fazem: fetch + reset --hard no branch remoto + `npm run build` +
`firebase deploy --only hosting --project sos-almox`.

⚠️ **Sempre com `--only hosting`.** O `firebase.json` declara `functions` (pasta `functions/`,
o briefing diário por e-mail do João — `onSchedule` às 7h, segredos `GMAIL_USER`,
`GMAIL_APP_PASSWORD` e `BRIEFING_TEST_TOKEN` no Secret Manager). Um `firebase deploy` **sem**
o `--only` tentaria republicar a automação junto com o site. Publicar a função é assunto
separado, e só quando o João pedir: `firebase deploy --only functions`.

Regras ao instruir o usuário:
- **PowerShell NÃO aceita `&&`** — sempre dar os comandos um por linha (no zsh do Mac aceita,
  mas separar ajuda a ver onde falhou)
- ⚠️ `git reset --hard` APAGA alteração local não commitada na máquina dele. O `deploy.sh`
  pergunta antes; nos comandos soltos, avisar.
- Após deploy, orientar **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
- Se algo "não mudou" depois do deploy, suspeitar de cache — conferir se o asset tem nome novo
- Se o download de um arquivo (patch etc.) sumir no Mac, lembrar que o navegador costuma
  TIRAR OS HÍFENS do nome — conferir com `ls ~/Downloads/`
- `firebase logout --token <t>` derruba TAMBÉM o login local da máquina do João. Se der
  "Failed to authenticate, have you run firebase login?", é só `npx firebase-tools login`
  (conta `bigpeixoto12@gmail.com`) — não precisa refazer o build.

## 🧭 REGRA DE SESSÕES — uma de cada vez

Todas as sessões empurram para o MESMO branch (`claude/laughing-carson-FcEmu`) e o
`deploy.ps1` faz `git reset --hard` nesse branch. Por isso:

1. **Trabalhar em sessões focadas por assunto** (ex: uma só para filtros, outra para
   manutenção) é bom — sessão mais limpa, menos risco de mexer no módulo errado.
2. ⛔ **NUNCA rodar duas sessões ativas ao mesmo tempo dando push.** Se a sessão A
   empurra e a B empurra por cima sem saber, uma sobrescreve a outra — mesmo tipo de
   perda do rebase. **Uma sessão ativa por vez; terminar uma antes de abrir outra.**
3. Quem abre sessão é o usuário (Claude não consegue criar sessões). Por isso TODA
   sessão começa com o checklist abaixo, para detectar se outra mexeu antes.

## ✅ Checklist ao retomar uma sessão

1. `git log --oneline -5` e `git status` — conferir onde o branch está
2. `git fetch origin claude/laughing-carson-FcEmu` — conferir se local e remoto batem
   (se o remoto estiver à frente, outra sessão mexeu — fazer `git reset --hard` para o
   remoto ANTES de editar, depois de anotar o SHA local atual)
3. Ler este arquivo inteiro antes de qualquer alteração
4. Em dúvida sobre o que existia antes, conferir o histórico do arquivo:
   `git log --oneline -- <arquivo>` e `git show <sha>:<arquivo>`
