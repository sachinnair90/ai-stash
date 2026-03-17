#!/usr/bin/env bash
# pre-push-reminder
# Intercepts `git push` commands and prints a pre-push checklist reminder.
# Non-blocking — exits 0 after printing so the push proceeds normally.

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only trigger on git push commands
if [[ "$TOOL_INPUT" != *"git push"* ]]; then
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-push checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [ ] Tests pass locally"
echo "  [ ] No console.log / debug statements"
echo "  [ ] No hardcoded secrets or tokens"
echo "  [ ] PR description ready"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
