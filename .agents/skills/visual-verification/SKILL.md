---
name: visual-verification
description: "Use after implementing any UI-facing feature (e.g. diagram rendering, table view). Takes a screenshot of the affected UI state, reads the screenshot to verify it matches the spec's visual requirements, and reports pass/fail with the screenshot attached."
---

# Visual verification

Hard check after any UI-facing implementation (diagram rendering, table view, layout, etc.). Do not treat the feature as done until this skill reports **pass**.

## Prerequisites

- Spec (or ticket) with the expected visual behavior — path or content from the user / originating issue.
- App reachable in a state that shows the affected screen or component (dev server URL, route, and any setup steps).
- Capture target: which screen/component and viewport (default desktop unless the spec says otherwise).

If any of these are missing, ask before capturing.

## Process

### 1. Take a before/after screenshot of the relevant screen or component

- **Before**: capture the UI state prior to the change when a baseline still exists (previous commit, feature flag off, or user-supplied baseline). Skip only when there is no meaningful before state; note that in the report.
- **After**: capture the UI state with the new implementation.

How to capture (first that works):

1. Project browser/e2e helper already in the repo (Playwright, Cypress, Storybook, etc.) — use it.
2. Otherwise a one-shot Playwright/Puppeteer capture against the local URL at the required viewport.
3. If automated capture is impossible, ask the user for before/after image files and proceed with those.

Save images under a scratch path such as `.scratch/visual-verification/` (create if needed). Prefer PNG. Name them clearly (`before.png`, `after.png`).

### 2. Compare the result against the spec's described expected behavior

- Read the spec's visual requirements (layout, content visibility, empty/error states, labels, hierarchy).
- **Read the screenshot files with the Read tool** (image input). Inspect what is actually on screen — do not infer from code alone.
- Compare after (and before→after delta when a before exists) to the spec. Check only what the spec requires; do not invent extra aesthetic criteria.

### 3. Output a pass/fail verdict with the screenshot embedded

Use the report format below. Embed the after screenshot (and before when present) as markdown images so they appear in the chat.

### 4. If fail, describe exactly what visual discrepancy was found

Name the missing/wrong/extra visual element, where it appears (region of the UI), and what the spec said should be there. One discrepancy per bullet. No vague "doesn't look right".

## Output

```markdown
## Visual verification

**Target:** <screen / component / route>
**Spec:** <path or issue ref>
**Verdict:** pass | fail

### Screenshots
![before](<path-or-omit-if-none>)
![after](<path>)

### Comparison
- <one line per checked requirement: met / not met>

### Discrepancies
(none if pass)
- <exact visual discrepancy vs spec>
```

## Gate

- **pass** → feature may proceed.
- **fail** → fix the UI, re-capture after, re-run this skill until pass.
