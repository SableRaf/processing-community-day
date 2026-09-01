#!/usr/bin/env bash
set -euo pipefail

# Run from repo root to keep relative paths consistent.
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

tests=(
  ".github/scripts/event-issue-helpers.test.mjs"
  ".github/scripts/process-new-event-issue.test.mjs"
  ".github/scripts/process-edit-event-issue.test.mjs"
  ".github/scripts/process-new-zine-issue.test.mjs"
  ".github/scripts/plus-code.test.mjs"
  ".github/scripts/zines.test.mjs"
)

for test in "${tests[@]}"; do
  printf '\n=== %s ===\n' "$test"
  node --test "$test"
done

printf '\n=== .github/scripts/zine-build.test.mjs ===\n'
node --test ".github/scripts/zine-build.test.mjs"

printf '\n=== Build data.json dependencies ===\n'
npm --prefix "${root_dir}/pcd-website" run build

printf '\n=== .github/scripts/data-json.test.mjs ===\n'
node --test ".github/scripts/data-json.test.mjs"
