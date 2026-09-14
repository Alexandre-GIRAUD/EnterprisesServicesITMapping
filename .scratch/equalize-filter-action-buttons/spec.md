# Equalize filter action button sizes

Status: ready-for-agent

## Problem Statement

In the graph filter drawer, the action buttons (Clear, Apply, Pin view on the root view; Clear and Done on the detail view) do not share the same width and height. Pin view in particular is sized differently (extra min-width and horizontal padding), so the action row looks uneven and harder to scan.

## Solution

Make every button in the filter drawer action rows the same width and the same height, while keeping each button’s existing color role (neutral Clear, accent Apply/Done, views-accent Pin view).

## User Stories

1. As a map user, I want Clear, Apply, and Pin view to be the same size, so that the filter action row looks consistent and easy to hit.
2. As a map user, I want Clear and Done on a filter dimension detail view to be the same size, so that drilling into a dimension feels consistent with the root actions.
3. As a map user, I want Apply to keep its accent color after the size change, so that the primary action stays visually distinct.
4. As a map user, I want Pin view to keep its views-accent color after the size change, so that pinning remains recognizable.
5. As a map user, I want Clear to keep its neutral styling after the size change, so that destructive/reset actions stay secondary.
6. As a map user, I want equal sizing to hold when Pin view is disabled, so that the layout does not jump when the graph is still loading.
7. As a map user, I want equal sizing to hold when Apply is disabled (invalid filter selection), so that the action row does not reflow when Apply is blocked.
8. As a map user, I want button labels to remain fully readable at the equal size, so that I can still tell Clear, Apply, Pin view, and Done apart.
9. As a developer verifying the change, I want an automated check on the action-row sizing contract, so that unequal pin-only width/padding overrides do not return unnoticed.
10. As a developer verifying the change, I want a visual screenshot of the action rows, so that equal width and height can be confirmed by eye.

## Implementation Decisions

- Change only the filter drawer action-row sizing: root actions (Clear / Apply / Pin view) and detail actions (Clear / Done).
- Keep color variants as they are today; do not restyle hover/focus/disabled colors beyond what equal sizing requires.
- Prefer a shared sizing rule for all buttons inside the compact action row over per-button width overrides (remove pin-only min-width / extra horizontal padding that break equality).
- Buttons in an action row share equal width and equal height (same box size within each row).
- No new React props or APIs; this is a layout/CSS contract on the existing compact action buttons.
- No domain model or API changes.

## Testing Decisions

- Good tests assert external layout contract behavior (equal width and height for action buttons in a row), not incidental class name churn.
- Seam under test: the filter action-row layout contract for root and detail action rows.
- Automated check: assert that compact action buttons share the same width/height sizing rules and that pin variant no longer applies a conflicting min-width or extra horizontal padding.
- Prior art: the repo has no frontend unit test runner yet; use Node’s built-in test runner against the stylesheet contract so no new dependency is required.
- Visual verification: capture before/after screenshots of the filter drawer action rows and confirm equal button boxes by inspecting the images.

## Out of Scope

- Changing button labels, order, or click behavior
- Changing filter logic, pin-view persistence, or apply semantics
- Restyling other filter UI (drill buttons, back button, dimension lists)
- Introducing a full frontend test framework (Vitest/Playwright) beyond a minimal stylesheet contract test
- Mobile-specific redesign beyond the shared equal-size rule applying wherever these actions render

## Further Notes

Clarified in grill-me: same width and height; include detail actions; colors stay. Workflow smoke purpose: verify automatic checkpoint commits and visual-verification screenshots end-to-end.
