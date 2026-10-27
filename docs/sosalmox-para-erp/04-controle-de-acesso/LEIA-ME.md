# Controle de acesso

`firestore.rules` é o arquivo de regras de autorização que roda hoje em produção. Vale como
**especificação do modelo de acesso**, mesmo que o ERP use outro mecanismo.

> ⚠️ O arquivo contém também um bloco de outro sistema da SOS (controle de combustível),
> porque os dois dividem o mesmo projeto Firebase. Ignore as regras com prefixo `abast_`.

---

## Os três níveis

### 1. Usuário logado e ativo

A maioria das coleções exige usuário autenticado **e** com `ativo != false`. Usuário
desativado não lê nada — a desativação é a forma de desligar alguém sem apagar o histórico.

### 2. Papel

A escrita é restrita por perfil, e o recorte não é o mesmo da leitura. Exemplos que importam:

- **Materiais e eventos**: escrita só para admin, gerente e almoxarife. O mecânico lê, não escreve.
- **Geradores e veículos**: o mecânico **escreve** — ele atualiza horímetro e status.
- **Baixa de filtro**: o mecânico escreve, porque é ele quem dá baixa ao fazer o serviço.
- **Compras**: só o perfil de compras e a gerência. O mecânico não enxerga.
- **Conversas do agente de IA**: privadas por usuário — só o dono lê, mais o admin para suporte.

### 3. Link público por token (*capability URL*)

Esta é a parte que mais importa reproduzir, e a mais fácil de errar.

**O problema que ela resolve:** o cliente que recebe o material e o colaborador que está no
local precisam assinar pelo celular. Exigir conta e login derruba a adesão — a assinatura
simplesmente deixa de ser colhida, e aí não há como provar quem levou o material.

**Como funciona:** o ID do documento é o token, e ele está na URL. Quem tem o link, acessa
aquele documento — só aquele.

As regras em produção:

```
allow get:    if true;                    // leitura pública pelo token
allow list:   if usuário logado;          // NUNCA listar a coleção publicamente
allow create: if perfil autorizado;
allow update: if perfil autorizado
              OU (anônimo, mas apenas uma vez e sem alterar o conteúdo assinado)
```

A escrita anônima tem quatro travas, e todas são necessárias:

1. **Transição única**: só `pendente → assinado`. Documento já assinado não aceita mais escrita.
2. **Conteúdo congelado**: a lista de itens, o evento e o tipo não podem mudar. É justamente
   essa lista que as duas partes estão assinando — se ela puder mudar depois, o documento
   não prova nada.
3. **Assinatura da outra parte protegida**: no termo de entrega, a assinatura da SOS já veio
   gravada e não pode ser substituída.
4. **Sem listagem**: `list` continua exigindo login. Sem isso, qualquer pessoa enumeraria
   todos os documentos de assinatura da empresa.

As fotos anexadas por quem assina seguem a mesma lógica: criação anônima permitida, mas só
para um termo que existe e ainda não foi assinado.

---

## Ao migrar para o ERP

O mecanismo muda (provavelmente middleware de autorização + rota pública), mas as quatro
travas acima precisam sobreviver. São elas que fazem o documento assinado ter valor.

Sugestão: trate o token como um recurso de uso único com estado, não como uma rota pública
qualquer. E registre o momento da assinatura (`assinado_em`) — é o que dá data certa ao
documento.
