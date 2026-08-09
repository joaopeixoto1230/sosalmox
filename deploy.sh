#!/usr/bin/env bash
# Deploy do SOS Almoxarifado (macOS / Linux).
# Equivalente ao deploy.ps1 usado no Windows.
#
# Uso:  ./deploy.sh
#
# ATENCAO: este script faz `git reset --hard` para o branch remoto. Qualquer
# alteracao local nao commitada e PERDIDA. Se voce mexeu em algo na maquina,
# commite antes de rodar.

set -euo pipefail

BRANCH="claude/laughing-carson-FcEmu"
PROJETO="sos-almox"

cd "$(dirname "$0")"

echo "==> Pasta: $(pwd)"

# Avisa antes de descartar trabalho local nao commitado.
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "!! Existem alteracoes locais nao commitadas:"
  git status --short
  echo ""
  read -r -p "Elas serao DESCARTADAS. Continuar? (s/N) " resposta
  case "$resposta" in
    s|S|sim|Sim) ;;
    *) echo "Cancelado."; exit 1 ;;
  esac
fi

echo "==> Buscando $BRANCH do GitHub..."
git fetch origin "$BRANCH"

echo "==> Alinhando com o remoto..."
git reset --hard "origin/$BRANCH"

echo "==> Instalando dependencias..."
npm install

echo "==> Gerando o build..."
npm run build

echo "==> Publicando no Firebase Hosting ($PROJETO)..."
npx firebase-tools deploy --only hosting --project "$PROJETO"

echo ""
echo "==> Deploy concluido."
echo "    No navegador, use Cmd+Shift+R para limpar o cache."
