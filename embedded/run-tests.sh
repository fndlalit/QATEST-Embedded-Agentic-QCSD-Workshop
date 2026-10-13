#!/usr/bin/env bash
# Compiles and runs the Unity tests for the C twin of the block transfer module.
# Usage: npm run test:c            (runs embedded/test_block_transfer.c)
#        npm run test:c -- FILE.c  (runs another Unity test file from embedded/)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

CC="${CC:-}"
if [ -z "$CC" ]; then
  for candidate in cc gcc clang; do
    if command -v "$candidate" >/dev/null 2>&1; then CC="$candidate"; break; fi
  done
fi
if [ -z "$CC" ]; then
  echo "No C compiler found (looked for cc, gcc, clang)."
  echo "The C twin is optional: Exercises 0 to 5 do not need it. Install gcc or clang to run it."
  exit 0
fi

TEST_FILE="${1:-test_block_transfer.c}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
"$CC" -std=c99 -Wall -Wextra -I. -o "$OUT/run_tests" block_transfer.c unity/unity.c "$TEST_FILE"
"$OUT/run_tests"
