#!/usr/bin/env bash
# post-edit-typecheck
# Runs TypeScript type-checking after any Edit or Write tool use on a .ts/.tsx file.
# Exits 0 (success) silently. Exits non-zero and prints diagnostics on type errors.
# Runs asynchronously — does not block Claude Code.

set -euo pipefail

# Only run when a TypeScript file was edited
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
if [[ "$TOOL_INPUT" != *.ts && "$TOOL_INPUT" != *.tsx ]]; then
  exit 0
fi

# Find the project root (directory containing tsconfig.json)
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TSCONFIG="$PROJECT_ROOT/tsconfig.json"

if [[ ! -f "$TSCONFIG" ]]; then
  exit 0  # Not a TypeScript project
fi

# Run type-check
cd "$PROJECT_ROOT"

if command -v pnpm &>/dev/null && [[ -f "pnpm-lock.yaml" ]]; then
  TYPECHECK_CMD="pnpm exec tsc --noEmit"
elif command -v npx &>/dev/null; then
  TYPECHECK_CMD="npx tsc --noEmit"
else
  exit 0  # No TypeScript runner available
fi

OUTPUT=$($TYPECHECK_CMD 2>&1) || {
  echo "⚠ TypeScript errors detected after last edit:"
  echo "$OUTPUT"
  exit 1
}

exit 0
