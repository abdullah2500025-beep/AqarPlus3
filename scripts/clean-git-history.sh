#!/usr/bin/env bash
set -euo pipefail

# AqarPlus Safe Git History Cleanup Script
# NEVER modifies 'main' directly. Creates a backup first and works on an isolated branch.

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BACKUP_DIR="../aqarplus-git-backup-$(date +%Y%m%d-%H%M%S)"
TARGET_BRANCH="fix/production-hardening"

echo "=== 1. Creating mirror backup before touching Git history ==="
mkdir -p "$BACKUP_DIR"
git clone --mirror . "$BACKUP_DIR/repo-mirror.git"
if [ -d "data" ]; then
  tar -czf "$BACKUP_DIR/operational-data-backup.tar.gz" data
fi
echo "Backup saved safely at: $BACKUP_DIR"

echo "=== 2. Ensuring work happens on a non-main branch ($TARGET_BRANCH) ==="
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  git checkout -b "$TARGET_BRANCH"
else
  echo "Already on branch: $CURRENT_BRANCH"
fi

echo "=== 3. Removing tracked data, backups, documents, and zip archives from index ==="
git rm -r --cached --ignore-unmatch data/ AqarPlus3-main.zip .env .env.local dist/ dist-server/ dist-worker/ release/ || true

if command -v git-filter-repo >/dev/null 2>&1; then
  echo "=== 4. Scrubbing historical commits with git-filter-repo ==="
  git filter-repo --force \
    --path data \
    --path AqarPlus3-main.zip \
    --path .env \
    --invert-paths
  echo "History scrubbed on branch $(git rev-parse --abbrev-ref HEAD)."
  echo "Next: git push -u origin $(git rev-parse --abbrev-ref HEAD) --force-with-lease"
  echo "Then open a Pull Request to merge into main after review."
else
  echo "WARNING: git-filter-repo is not installed. Only current index entries were untracked."
  echo "Install git-filter-repo (pip install git-filter-repo) to purge past commit blobs safely."
fi
