#!/usr/bin/env bash
# A deliberate participant action, never a restart hook: indexing writes to AQE memory.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/check-workspace.sh"
test -f .agentic-qe/memory.db || { echo 'Run post-create.sh first.' >&2; exit 1; }
MARKER=.agentic-qe/devcontainer-workshop-prepared
if [ -f "$MARKER" ]; then
  echo 'Workshop baseline already prepared; keeping your graph and learned patterns.'
  bash .devcontainer/verify.sh
  exit 0
fi

# Keep a timestamped copy of the memory database before anything is written.
mkdir -p .agentic-qe/backups
BACKUP=".agentic-qe/backups/pre-workshop-$(date -u +%Y%m%dT%H%M%SZ)-$$.db"
sqlite3 .agentic-qe/memory.db ".backup '$BACKUP'"
test "$(sqlite3 -readonly "$BACKUP" 'PRAGMA integrity_check;')" = ok
printf 'Pre-workshop memory backup: %s\n' "$BACKUP"

# These are the Exercise 0 commands. The minimal child environment keeps provider
# credentials out of indexing, so the baseline is local and spends no tokens.
env -i HOME="$HOME" PATH="$PATH" aqe code index src/
aqe hg stats
aqe memory usage
# The first call with the embedder installed seeds AQE's foundational patterns
# and downloads the embedding model.
aqe learning stats
# Verification must pass before the completion marker is written.
bash .devcontainer/verify.sh
date -u +%FT%TZ > "$MARKER"
