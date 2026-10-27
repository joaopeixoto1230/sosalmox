# SOS Almoxarifado — pacote de implementação para o ERP

Tudo que é preciso para implementar o SOSALMOX como módulo do ERP da SOS Energia.

O sistema está **em produção e em uso diário** pela equipe. Este pacote não é o código-fonte da
aplicação: é a **especificação**, mais as regras de negócio em forma executável.

---

## Por onde começar

Leia nesta ordem. A ordem importa: as duas primeiras pastas mudam o desenho do banco, e
descobrir isso depois custa refazer.

| # | Pasta | O que é | Tempo |
|---|-------|---------|-------|
| 1 | `01-especificacao/` | O documento central. Entidades, campos, fluxos, regras. | ~1h de leitura |
| 2 | `02-regras-executaveis/` | As regras de negócio em JavaScript puro, com 206 testes que as definem. | roda em 1 min |
| 3 | `03-modelo-de-dados/` | Rascunho de schema PostgreSQL, com as regras como constraints. | referência |
| 4 | `04-controle-de-acesso/` | Modelo de permissão, incluindo os links públicos de assinatura. | referência |
| 5 | `05-conhecimento-operacional/` | O guia que a equipe usa no dia a dia. Explica a operação real. | referência |

**Se você só for ler uma coisa**, leia `regras_de_negocio` dentro do JSON da especificação.
São 16 regras, e cada uma registra o prejuízo que ela evita.

---

## O que este sistema faz

Controle de almoxarifado de uma empresa de locação de geradores:

- **Estoque de materiais elétricos** — cabos, caixas, QTAs, ferramental, consumíveis
- **Saída e devolução** para eventos, locações mensais e sublocações
- **Patrimônio** — 107 geradores, ~20 veículos, empilhadeiras
- **Manutenção** — ordens de serviço, preventivas, baixa de filtros
- **Estoque de filtros** por potência de gerador
- **Compras** — fila de solicitações
- **Documentos assinados** — romaneio, termo de entrega e devolução, declaração de sublocação

---

## As três coisas que mais derrubam quem reimplementa isto

### 1. Material tem três naturezas de controle, e elas não se unificam

- **Unidade**: cada cabo é um registro próprio. A saída zera o registro e prende o evento.
- **Contado**: fita, parafuso, alambrado. Quantidade dentro do mesmo registro, e **nunca**
  vinculado ao evento — prender o registro tiraria o resto da prateleira de circulação.
- **Por quantidade**: protetor de cabo. Não movimenta estoque de forma alguma.

Tentar unificar as três foi a origem de metade dos problemas que este sistema já teve.

### 2. A ausência de um campo é um VALOR, não um dado faltando

- Evento sem modalidade = Evento (e não locação)
- Ordem sem tipo = saída de evento (e não uso interno)
- Material sem grupo = grupo de eventos

Isso permitiu lançar três funcionalidades grandes sem migrar base em produção. No banco
relacional, vira DEFAULT de coluna — e o default precisa ser exatamente esse.

### 3. Quando o estoque desanda, não aparece erro nenhum

Esse é o padrão de falha deste domínio. Material que não volta para a prateleira não gera
exceção: ele simplesmente some do inventário disponível, e alguém descobre semanas depois,
quando precisa dele. Por isso as regras estão em testes — é o único jeito de pegar.

---

## Verificação feita antes de entregar

Não é só documento escrito; foi tudo executado:

- `02-regras-executaveis` — **206 testes passando**, rodados isolados deste pacote
  (`npm install && npm test`), fora do projeto original
- `03-modelo-de-dados/schema-postgres.sql` — **executado num PostgreSQL 16 limpo**,
  sem erro. As constraints foram testadas uma a uma com inserções que violam cada regra:
  as 5 violações foram barradas e os 2 casos legítimos passaram

---

## O que NÃO está aqui

- **Os dados reais.** A exportação deve ser feita depois que o modelo do ERP estiver fechado,
  para já sair no formato de destino em vez de exigir conversão dupla. O volume é pequeno
  (algumas centenas de registros por entidade).
- **O código de interface.** É React, e provavelmente o ERP tem padrão próprio. O que importa
  da interface está em `requisitos_nao_funcionais` no JSON — principalmente as exigências de
  celular, que não são opcionais: a operação de campo roda inteira em Android.
- **Integrações externas.** O sistema não tem nenhuma hoje, além de envio de e-mail e uma API
  de IA para o agente e a leitura do briefing diário.

---

## Dúvidas prováveis

**"Posso reimplementar do zero em outra linguagem?"**
Sim. Os módulos em `02-regras-executaveis` são JavaScript puro, sem framework nem banco —
servem como referência legível mesmo que o ERP seja em outra stack. Os testes descrevem o
comportamento esperado em português, caso a caso.

**"Preciso manter os links públicos de assinatura?"**
Sim, isso é requisito de operação. O cliente e o colaborador em campo assinam **sem login**,
pelo celular, por um link enviado no WhatsApp. Exigir conta derruba a adesão e as assinaturas
param de ser colhidas. O modelo de acesso está em `04-controle-de-acesso/`.

**"A numeração OM-AAAA-NNN reinicia por ano?"**
Não. O número é um sequencial global contínuo; só a exibição inclui o ano.
