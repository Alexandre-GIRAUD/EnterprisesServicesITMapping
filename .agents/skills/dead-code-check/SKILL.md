---
name: dead-code-check
description: "Use after implementing a feature, before opening a PR. Scans the diff for unused code: unused functions, variables, imports, unreachable branches, and orphaned files no longer referenced."
---

# Dead code check

Hard gate after implementing a feature and before opening a PR. If dead code is found, the feature is **not validated** — do not open the PR until findings are fixed and this scan reports **clean**.

## When to run

- After the feature implementation (and its tests) are in place
- Again immediately before opening a PR

Default range: `git diff <base>...HEAD` against the default branch merge-base. After a single commit with no PR yet, `HEAD~1...HEAD` is fine if the user says so.

## What to flag

Scan **added, modified, and deleted** paths in the range. Flag:

| Category | Meaning |
|---|---|
| Unused imports | Import/require brought in and never referenced in that file |
| Unused variables | Declared locals/params (non-required API surface) never read |
| Unused functions | New or leftover functions/methods with no remaining callers in the repo |
| Unreachable branches | `if`/`else`/`switch` arms or code after `return`/`throw` that can never run |
| Orphaned files | Files in the change (or left behind by it) with no remaining references from the rest of the codebase |

**Do not flag**: public/exported API kept for external consumers when the repo or spec says so; test-only helpers referenced only from tests; symbols required by a framework via convention (DI, decorators, route manifests) when that wiring is visible.

Prefer project tooling when it exists (`eslint` unused-imports, `knip`, `ts-prune`, `vulture`, IDE unused diagnostics). Tool output does not replace the orphaned-file and unreachable-branch pass — still do those on the diff.

## Process

1. Resolve the diff range; confirm it is non-empty.
2. List changed files. For removals, check callers were updated and no orphan imports remain.
3. For each added/modified source file, check unused imports, variables, and functions introduced or left idle by the change.
4. Grep the repo for new symbols that look unreferenced; confirm orphans.
5. Skim control flow in touched functions for unreachable branches.
6. Emit the output below. On any finding: **stop** — feature not validated until cleaned and re-scanned.

## Output

A list of dead code findings, or `clean` if none found:

```markdown
## Dead code check

**Range:** `<diff range>`
**Result:** `clean` | `blocked`

### Findings
- `path/to/file:LINE` — [category] what is unused / why

(or: clean)
```
