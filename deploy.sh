#!/bin/bash
# Publish (or update) maCros on GitHub Pages. Run from anywhere: ./deploy.sh
# Needs the GitHub CLI signed in once:  gh auth login
set -euo pipefail
cd "$(dirname "$0")"
GH="$(command -v gh || echo "$HOME/.local/bin/gh")"
REPO_NAME="${REPO_NAME:-macros}"

"$GH" auth status >/dev/null 2>&1 || { echo "Not signed in to GitHub. Run: $GH auth login"; exit 1; }
LOGIN="$("$GH" api user --jq .login)"
ID="$("$GH" api user --jq .id)"

if [ ! -d .git ]; then
  git init -q -b main
  git config user.name "$LOGIN"
  git config user.email "${ID}+${LOGIN}@users.noreply.github.com"
fi
"$GH" auth setup-git >/dev/null 2>&1 || true

git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "${1:-Update maCros}" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi

if ! "$GH" repo view "$LOGIN/$REPO_NAME" >/dev/null 2>&1; then
  "$GH" repo create "$REPO_NAME" --public --source . --remote origin --push \
    --description "maCros: offline Filipino-friendly macro identifier (PWA)"
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$LOGIN/$REPO_NAME.git"
  git push -q -u origin main
fi

# Turn on GitHub Pages from the main branch (no-op if already on)
"$GH" api "repos/$LOGIN/$REPO_NAME/pages" >/dev/null 2>&1 || \
  "$GH" api -X POST "repos/$LOGIN/$REPO_NAME/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null

echo "Published: https://$LOGIN.github.io/$REPO_NAME/  (first publish can take 1-2 minutes)"
