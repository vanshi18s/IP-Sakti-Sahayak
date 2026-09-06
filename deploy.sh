#!/bin/bash
# One-command deploy: pushes current branch to GitHub and to the Hugging Face Space.
# Usage: ./deploy.sh "commit message"
#
# PDFs are NOT pushed from here (HF rejects plain binaries). Upload them once via
# the Space's Files tab into data/raw/ — this script leaves them untouched.
set -e
MSG="${1:-Update}"
cd "$(dirname "$0")"

git add .
git commit -m "$MSG" || true
git push

CUR=$(git rev-parse --abbrev-ref HEAD)
git checkout --orphan hf-tmp >/dev/null 2>&1
git rm -r --cached . >/dev/null 2>&1
git add -A
git reset -q -- 'data/raw/*.pdf' 2>/dev/null || true
git commit -qm "Deploy: $MSG"

# Fetch what is already on the Space and keep its files (uploaded PDFs) on top of ours.
git fetch -q hf main
git merge -q --allow-unrelated-histories -X ours hf/main -m "merge space state" || true

git push hf hf-tmp:main --force
git checkout -q "$CUR"
git branch -qD hf-tmp
echo "Deployed. Space will rebuild in a few minutes."
