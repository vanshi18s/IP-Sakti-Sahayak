#!/bin/bash
# One-command deploy: pushes current branch to GitHub and to the Hugging Face Space.
# Usage: ./deploy.sh "commit message"
set -e
MSG="${1:-Update}"
cd "$(dirname "$0")"

git add .
git commit -m "$MSG" || true
git push

# HF needs a PDF-free history: build a fresh single-commit branch and force-push it.
CUR=$(git rev-parse --abbrev-ref HEAD)
git checkout --orphan hf-tmp >/dev/null 2>&1
git rm -r --cached . >/dev/null 2>&1
git add -A
git reset -q data/raw/*.pdf 2>/dev/null || true
git commit -qm "Deploy: $MSG"
git push hf hf-tmp:main --force
git checkout -q "$CUR"
git branch -qD hf-tmp
echo "Deployed. Space will rebuild in a few minutes."
