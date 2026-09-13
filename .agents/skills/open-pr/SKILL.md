---
name: open-pr
description: "Use once a feature has passed tdd, code-review, dead-code-check, visual-verification, and security-secrets-scan."
---

# Open PR

Open a pull request for a finished feature branch. **This skill must NEVER merge the PR. Merging is always a manual human action.**

## Preconditions

Confirm (ask if unclear) that the feature has already passed:

1. **tdd**
2. **code-review**
3. **dead-code-check**
4. **visual-verification**
5. **security-secrets-scan**

If any gate failed or was skipped, stop and run that skill first. Do not open a PR to "finish later."

## Process

### 1. Rebase the feature branch on main

- Confirm current branch is the feature branch (not `main` / `master`).
- `git fetch origin`
- Rebase onto `origin/main` (or `origin/master` if that is the default branch):  
  `git rebase origin/main`
- Resolve conflicts if any; do not continue with a broken rebase.
- If the branch was already pushed, update the remote after a successful rebase with a **non-destructive** push the user allows (`git push --force-with-lease`). Never `--force`. Never push if the user forbade it — ask first.

### 2. Re-run the full test suite after rebase

Rebase can silently break things. Run the project's **full** test suite (and typecheck if that is a standard script). If anything fails: fix or stop — do not open the PR.

### 3. Verify there are no uncommitted changes

- `git status` must be clean (no staged/unstaged/untracked work that belongs in the PR).
- If dirty: commit (Conventional Commits per project rules) or discard only with explicit user approval. Do not open a PR with a dirty tree.

### 4. Run security-secrets-scan one more time on the final diff as a last gate

Follow `.agents/skills/security-secrets-scan/SKILL.md` on `git diff origin/main...HEAD` (or the default-base equivalent). Proceed only if the result is **clean**.

### 5. Generate a PR description covering: what changed, why, how it was tested, screenshots from visual-verification

Draft from the branch commits and conversation. Use this body shape:

```markdown
## Summary
- what changed
- why

## Test plan
- how it was tested (tdd / suite commands / notable cases)

## Visual verification
- embed or link screenshots from visual-verification (after, and before if present)
- note pass verdict / path to images under `.scratch/visual-verification/` when files exist

## Gates
- [x] tdd
- [x] code-review
- [x] dead-code-check
- [x] visual-verification
- [x] security-secrets-scan (final)
```

Title: concise, Conventional Commit style subject when it fits (`feat(scope): …`).

### 6. Open the PR

- Push the branch if needed (`-u` when no upstream).
- Create with `gh pr create` (base = default branch). Do **not** pass merge flags.
- Return the PR URL to the user.

## Hard prohibitions

- **Never** merge the PR (`gh pr merge`, merge commits via UI automation, auto-merge enablement, or any equivalent).
- **Never** delete the branch as part of this skill.
- **Never** skip steps 2–4 after a rebase.
