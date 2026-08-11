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
#
# So o que ESTA no controle de versao corre risco: o `git reset --hard` la
# embaixo nao apaga arquivo nao rastreado (isso seria `git clean`). Por isso a
# pergunta e feita apenas para arquivo modificado — antes o script pedia
# confirmacao por causa de uma pasta nova qualquer e dava um susto a toa.
ALTERADOS="$(git status --porcelain --untracked-files=no)"
NOVOS="$(git ls-files --others --exclude-standard)"

if [ -n "$NOVOS" ]; then
  echo ""
  echo "-- Arquivos fora do controle de versao (serao MANTIDOS):"
  echo "$NOVOS" | sed 's/^/   /'
fi

if [ -n "$ALTERADOS" ]; then
  echo ""
  echo "!! Arquivos do projeto alterados nesta maquina:"
  echo "$ALTERADOS" | sed 's/^/   /'
  echo ""
  read -r -p "Estas alteracoes serao DESCARTADAS. Continuar? (s/N) " resposta
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
