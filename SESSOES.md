# Guia de Sessões Focadas — SOS Almoxarifado

> Como usar: abra uma sessão NOVA, cole a **frase de abertura** do assunto que vai
> trabalhar, e trabalhe só nele. Termine/feche essa sessão antes de abrir outra.
> **Nunca duas sessões ativas ao mesmo tempo dando push** (regra no CLAUDE.md).
>
> Toda sessão, antes de editar, eu rodo o checklist do CLAUDE.md (git fetch + conferir
> se o branch está sincronizado). Você não precisa fazer nada disso — só colar a frase.

---

## 1. Filtros

**Frase de abertura (cole isto):**
> Sessão focada só nos FILTROS. Não mexa em manutenção, patrimônio, saída nem outros módulos.

- **Escopo:** `src/components/filtros/` (Filtros, FiltroCard, EntradaFiltroModal,
  BaixaFiltroModal, NovoFiltroModal, SaidaFiltrosModal)
- **Coleções Firestore:** `filtros`, `entradas_filtro`, `baixas_filtro`
- **Não tocar:** ordens de serviço, geradores, saída de material.

## 2. Manutenção (Ordens de Serviço)

**Frase de abertura:**
> Sessão focada só na MANUTENÇÃO / ordens de serviço. Não mexa em filtros nem patrimônio.

- **Escopo:** `src/components/manutencao/` (Manutencao, OSCard, NovaOS, DetalheOS)
- **Coleções:** `ordens_servico`, `contadores/ordens_servico`
- **Cuidado:** DetalheOS já tem editar, excluir (devolve filtros ao estoque) e imprimir
  PDF. Preservar tudo isso. A baixa de filtros na conclusão toca a coleção `filtros`,
  mas só de leitura/escrita de quantidade — não mexer na UI de filtros.

## 3. Patrimônio (Geradores)

**Frase de abertura:**
> Sessão focada só no PATRIMÔNIO / geradores. Não mexa em manutenção nem saída.

- **Escopo:** `src/components/patrimonio/` (Patrimonio, GGCard, DetalheGG)
- **Coleções:** `geradores`
- **Cuidado:** o status do GG muda automaticamente por saída/devolução/OS. Mexer aqui
  só na exibição e edição do gerador, não na lógica de status dos outros módulos.

## 4. Saída de Material & Eventos

**Frase de abertura:**
> Sessão focada só na SAÍDA DE MATERIAL e EVENTOS. Não mexa em devolução nem estoque.

- **Escopo:** `src/components/saida/` (SaidaMaterial, ItemCard, steps/) e
  `src/components/eventos/` (Eventos)
- **Coleções:** `ordens_saida`, `eventos`
- **Cuidado:** fluxo de 5 passos, multi-gerador, romaneio e relatório com assinaturas.
  Ler o passo inteiro antes de editar.

## 5. Devolução & Transferência

**Frase de abertura:**
> Sessão focada só em DEVOLUÇÃO e TRANSFERÊNCIA. Não mexa na saída de material.

- **Escopo:** `src/components/devolucao/` (DevolucaoMaterial, ItemDevolucao) e
  `src/components/transferencia/` (Transferencia)
- **Coleções:** `ordens_saida`, `eventos`, `materiais`

## 6. Estoque de Materiais

**Frase de abertura:**
> Sessão focada só no ESTOQUE de materiais. Não mexa em filtros nem saída.

- **Escopo:** `src/components/estoque/` (Estoque, MaterialCard, NovoMaterialModal)
- **Coleções:** `materiais`
- **Cuidado:** filtro de status em pills coloridas já existe. Preservar.

## 7. Compras

**Frase de abertura:**
> Sessão focada só em COMPRAS. Não mexa em filtros nem estoque.

- **Escopo:** `src/components/compras/` (ComprasDashboard, FilaSolicitacoes,
  Fornecedores, NovoFornecedorModal)
- **Coleções:** `solicitacoes_compra`

## 8. Agente IA

**Frase de abertura:**
> Sessão focada só no AGENTE IA. Não mexa em outros módulos.

- **Escopo:** `src/components/agente/` (AgenteIA, AgenteChat, AgenteFlutuante)
- **Coleções:** `conversas_agente`
- **Cuidado:** usa `VITE_ANTHROPIC_API_KEY` e modelo Claude Haiku. Botão flutuante
  aparece em todas as telas via layout — não duplicar.

## 9. Relatórios

**Frase de abertura:**
> Sessão focada só em RELATÓRIOS. Não mexa nos módulos de origem dos dados.

- **Escopo:** `src/components/relatorios/` (Relatorios)
- **Cuidado:** abas Saídas / Devoluções / Condições já existem. Preservar as três.

## 10. Usuários & Permissões

**Frase de abertura:**
> Sessão focada só em USUÁRIOS e PERMISSÕES de acesso. Não mexa em telas de operação.

- **Escopo:** `src/components/usuarios/` (Usuarios, NovoUsuarioModal,
  EditarUsuarioModal) e `src/utils/permissions.js`
- **Coleções:** `usuarios`
- **Cuidado:** mexer em `permissions.js` afeta o menu de todos os perfis. Conferir o
  mapa MODULOS inteiro antes de editar.

---

## Regras que valem para QUALQUER sessão

- Uma sessão ativa por vez. Terminar uma antes de abrir a próxima.
- Layout / dark mode / logo (`src/components/layout/`, `index.css`, `index.html`):
  mexer com cuidado — afeta todas as telas. Se trocar a logo, usar sufixo de versão
  novo (`-v3`...) e atualizar Sidebar, LoginPage e index.html.
- Deploy é sempre você, no PowerShell: `powershell -ExecutionPolicy Bypass -File deploy.ps1`
- Em caso de dúvida sobre o que existia antes, eu consulto o histórico do arquivo no git.
