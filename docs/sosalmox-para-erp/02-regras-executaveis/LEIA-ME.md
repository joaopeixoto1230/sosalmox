# Regras de negócio executáveis

16 módulos de **JavaScript puro** — sem React, sem Firebase, sem banco — e os **206 testes**
que definem o comportamento de cada um.

```bash
npm install
npm test
```

Roda isolado deste pacote. Não precisa do projeto original.

---

## Por que isto vem junto com a especificação

Documento descreve; teste **define**. Cada teste aqui tem um nome em português dizendo a regra,
e vários têm um comentário explicando o prejuízo que a regra evita. Quando a especificação e o
teste discordarem, **o teste está certo** — ele é o que roda em produção.

Se o ERP for em outra linguagem, estes arquivos continuam valendo como referência: leia o teste,
reproduza o comportamento, use os mesmos casos de borda.

---

## O que cada módulo resolve

### Estoque — o núcleo

| Arquivo | O que faz |
|---|---|
| `contagem.js` | As três naturezas de material. Todos os cálculos de baixa, devolução e estorno. **Comece por aqui.** |
| `estoqueEspecie.js` | Estoque baixo por espécie (categoria + bitola). Contém a regra de que cabo nunca alerta. |
| `categorias.js` | Grupos, categorias e tipos. Categoria não é lista fechada. |
| `sugestaoGrupo.js` | Sugere a qual grupo um material pertence, para migração em lote. |
| `sugestaoCadastro.js` | Sugere categoria e código a partir do nome do item. |

### Movimentação

| Arquivo | O que faz |
|---|---|
| `buscaDevolucao.js` | Monta a lista de devolução, acha material travado fora da prateleira. |
| `termos.js` | Termos de entrega e devolução da locação, e a conferência item a item. |
| `pendencias.js` | Os alertas do painel, incluindo preventiva vencida e material a cobrar. |
| `ruptura.js` | Previsão de ruptura de filtro e detecção de consumo fora do padrão. |

### Apoio

| Arquivo | O que faz |
|---|---|
| `permissions.js` | Perfis, módulos e montagem do menu por permissão. |
| `formatters.js` | Rótulos de status e a classificação de material por quantidade. |
| `mascaras.js` | CPF, CNPJ, RG e telefone. |
| `whatsapp.js` | Monta o link de conversa a partir de telefone brasileiro. |
| `gruposFrota.js`, `filtrosURL.js` | Agrupamentos da frota e filtros de URL, com teste de ida e volta. |
| `acoesAgente.js` | Definição das ações que o agente de IA pode propor. |
| `operadores.js`, `cores.js` | Listas de apoio. |

---

## Funções que merecem leitura atenta

**`contagem.js`**
- `materialContado(m)` — decide qual das três naturezas o material tem. Tudo depende disto.
- `patchSaidaEvento` / `patchDevolucaoEvento` — a baixa e o retorno no fluxo de evento.
- `contadosDoEvento(ordens, materiais)` — **o único jeito** de achar material contado que
  está num evento. Ele não guarda o vínculo no próprio registro.
- `patchStatusManual` / `estoqueAoEditar` — mantêm status e quantidade coerentes. Foram
  criadas depois de a mesma regra, escrita à mão em quatro telas, divergir entre elas.

**`estoqueEspecie.js`**
- `chaveEspecie` — a normalização da bitola ("35mm²" e "35" são a mesma espécie; o comprimento
  não separa).
- `categoriaDeCabo` — a lista do que nunca alerta.

**`buscaDevolucao.js`**
- `itensNoEvento` — soma as ordens com o material vinculado ao evento. Montar a devolução só
  pelas ordens deixava material invisível e preso para sempre.
- `materiaisPresos` — detecta inconsistência de estoque já instalada no banco. Vale muito
  reimplementar: é um diagnóstico que acha estrago que ninguém percebeu.

---

## Convenção dos testes

Os nomes dizem a regra em português, não o nome da função:

```
✓ acusa a vencida e a que vence dentro de uma semana
✓ equipamento com OS ABERTA sai da lista
✓ fita e alambrado zerados são falta de verdade, não defeito de cadastro
✓ NÃO marca material de evento de verdade
```

Os comentários dentro dos testes registram o caso real que motivou cada regra. Vale ler mesmo
sem rodar.
