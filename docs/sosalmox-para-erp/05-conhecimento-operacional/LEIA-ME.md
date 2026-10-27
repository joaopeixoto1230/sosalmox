# Conhecimento operacional

`conteudoPlaybook.js` é o guia que a equipe da SOS usa no dia a dia, escrito em linguagem de
chão de galpão. Ele vive dentro do sistema (a equipe consulta pelo celular na hora da dúvida)
e também é impresso.

## Por que isto está no pacote

A especificação diz o que o sistema FAZ. O playbook diz como a operação REALMENTE acontece —
e é aí que moram as decisões que parecem estranhas no código e fazem todo sentido no pátio.

Exemplos do que só está aqui:

- por que a assinatura de quem recebe nunca pode travar a saída;
- por que o material de locação precisa de termo e o de evento não;
- o que a equipe faz quando um item some;
- qual é a sequência real de uma saída, do balcão ao caminhão.

## Formato

O conteúdo está em **dados**, não em interface: um array de seções, cada uma com blocos
(`p`, `lista`, `passos`, `atencao`, `dica`, `tabela`). A tela e a versão impressa leem a mesma
fonte, de propósito — texto escrito direto na tela criaria duas cópias e a impressa
envelheceria em silêncio.

É só converter para o formato de conteúdo do ERP. A estrutura de blocos já está pronta para isso.

## Recomendação

Mantenha um guia equivalente no ERP, e atualize-o junto com o fluxo. A equipe de campo depende
dele para não depender de uma pessoa só.
