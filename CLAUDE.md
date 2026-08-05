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
- Status "Em Locação"; edição de horímetro e opção "sem horímetro"
- Edição de gerador liberada para almoxarife e mecânico

### Saída de Material (`src/components/saida/`)
- Passo inicial **Tipo de Saída**: **Evento** (fluxo antigo de 5 passos — evento, multi-gerador,
  romaneio, confirmação com assinaturas) ou **Uso Interno** (ver abaixo). Não remover o seletor.
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

## 🚀 Deploy (sempre na máquina do usuário, Windows)

O servidor remoto NÃO consegue fazer deploy (rede bloqueia OAuth do Firebase).
O deploy é feito pelo usuário no PowerShell, pasta `C:\Users\amanda\Desktop\sosalmox`:

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

O `deploy.ps1` faz: fetch + reset --hard para o branch remoto + `npm run build` +
`firebase deploy --only hosting --project sos-almox`.

Regras ao instruir o usuário:
- **PowerShell NÃO aceita `&&`** — sempre dar os comandos um por linha
- Após deploy, orientar **Ctrl+Shift+R** no navegador
- Se algo "não mudou" depois do deploy, suspeitar de cache — conferir se o asset tem nome novo

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
