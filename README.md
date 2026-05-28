# SOS Almoxarifado

Sistema de gestão de almoxarifado para SOS Energia — Fase 1.

## Stack

- React 19 + Vite 8
- Tailwind CSS v3
- Firebase v12 (Firestore + Auth)
- React Router v7

## Módulos (Fase 1)

- **Autenticação** — Firebase Auth com 5 perfis de acesso (Admin, Gerente, Almoxarife, Mecânico, Compras)
- **Saída de Material** — Fluxo em 5 passos com geração de Ordem de Material (OM-YYYY-NNN)
- **Devolução de Material** — Registro de retorno com status por item (OK, problema, cortado, perdido, parcial)
- **Transferência entre Eventos** — Movimentação direta de materiais sem passar pelo almoxarifado
- **Estoque** — Visão geral com filtros por categoria, status e alerta de estoque baixo
- **Dashboard** — Resumo de eventos ativos, itens em campo e alertas

## Configuração

1. Copie `.env.example` para `.env` e preencha as variáveis do Firebase
2. Instale as dependências: `npm install`
3. Inicie o servidor de desenvolvimento: `npm run dev`
4. (Opcional) Popule o banco com dados de exemplo: importe e chame `seedDatabase()` de `src/firebase/seed.js`

## Scripts

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de produção
npm run test      # Testes unitários (Vitest)
npm run lint      # ESLint
```

## Identidade Visual

- Vermelho primário: `#CC0000`
- Preto: `#0A0A0A`
- Fundo: `#F5F5F5`
- Fonte: Inter
