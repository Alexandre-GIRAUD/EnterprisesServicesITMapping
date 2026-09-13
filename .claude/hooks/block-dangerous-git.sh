#!/bin/bash
# PreToolUse hook: block destructive git commands before Claude Code runs them.
# Tuned for this repo's AGENTS.md workflow:
# - open-pr may push feature branches (and --force-with-lease after rebase)
# - post-merge cleanup may delete the feature branch
# - never force-push or delete main/master; never hard-reset / force-clean

INPUT=$(cat)

# Prefer node (available in this repo); fall back to jq if present.
if command -v node >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try { console.log(JSON.parse(d).tool_input.command || ''); }
  catch { console.log(''); }
});
")
elif command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
else
  echo "BLOCKED: cannot parse tool input (need node or jq)." >&2
  exit 2
fi

# Normalize whitespace for matching
NORMALIZED=$(printf '%s' "$COMMAND" | tr '\n' ' ')

block() {
  echo "BLOCKED: '$COMMAND' — $1 The user has prevented you from doing this. Ask the human to run it if needed." >&2
  exit 2
}

# Force-push targeting main/master (any --force / -f / --force-with-lease)
if echo "$NORMALIZED" | grep -qE 'git[[:space:]]+push'; then
  if echo "$NORMALIZED" | grep -qE '(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$))'; then
    if echo "$NORMALIZED" | grep -qE '(^|[[:space:]])(origin[[:space:]]+)?(main|master)([[:space:]]|$)|:main|:master|HEAD:main|HEAD:master|refs/heads/(main|master)'; then
      block "Force-push to main/master is forbidden."
    fi
    # Bare --force (not --force-with-lease) is always blocked
    if echo "$NORMALIZED" | grep -qE '(--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$))' \
      && ! echo "$NORMALIZED" | grep -qE '--force-with-lease'; then
      block "git push --force is forbidden (use --force-with-lease on a feature branch only, never on main)."
    fi
  fi
fi

# Hard reset — no confirmation path in this hook
if echo "$NORMALIZED" | grep -qE 'git[[:space:]]+reset[[:space:]].*--hard|reset[[:space:]]+--hard'; then
  block "git reset --hard is forbidden."
fi

# Force clean
if echo "$NORMALIZED" | grep -qE 'git[[:space:]]+clean[[:space:]]+.*-f'; then
  block "git clean -f is forbidden."
fi

# Discard working tree wholesale
if echo "$NORMALIZED" | grep -qE 'git[[:space:]]+checkout[[:space:]]+\.|git[[:space:]]+restore[[:space:]]+\.'; then
  block "Discarding the whole working tree (checkout/restore .) is forbidden."
fi

# Branch deletion of main/master only — feature-branch -D allowed for open-pr post-merge cleanup
if echo "$NORMALIZED" | grep -qE 'git[[:space:]]+branch[[:space:]]+(-D|-d|--delete)'; then
  if echo "$NORMALIZED" | grep -qE '(^|[[:space:]])(-D|-d|--delete)([=[:space:]]+)(main|master)([[:space:]]|$)|(^|[[:space:]])(main|master)([[:space:]]|$)'; then
    # Safer: if main or master appears as an operand after delete flags
    if echo "$NORMALIZED" | grep -qE 'branch[[:space:]]+(-D|-d|--delete)([=[:space:]]|.*[[:space:]])(main|master)([[:space:]]|$)'; then
      block "Deleting the main/master branch is forbidden."
    fi
  fi
fi

exit 0
