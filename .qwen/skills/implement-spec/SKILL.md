---
name: implement-spec
description: "Implement a specification in code until tests pass. Opening and merging a PR is not this skill — that is open-pr, gated by a human."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The goal is a complete implementation of the spec on a single feature branch, with tests passing. **Done when:** the new tests pass and the change matches the published spec. Creating a pull request is the `open-pr` skill, after later workflow gates. Merging a pull request is always a manual human action.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for **maximum concurrency**.

## Commits

Commit after each meaningful unit of work — do not wait until the ticket or the whole spec is done. A unit is done and must be committed when any of these is true:

- a test that was failing is now passing
- a function or behaviour slice is implemented and its tests pass
- a ticket's work has been integrated onto the feature branch

**Done when:** that slice is a Conventional Commit with both a concise subject and a body (see `.cursor/rules/dev-standards.mdc`), staging only files that belong to that slice (see `.cursor/rules/workflow-commits.mdc`). Skip only when the slice produced no file changes.

Implementer subagents follow the same commit rule on their worktree branches so history stays granular after integration.

## Steps

1. Read the spec and tickets. Read enough to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create a feature branch for the spec (not `main` / `master`). Stay on that branch for the rest of this skill.

4. Use **implementer subagents** to implement each ticket. Each implementer subagent should work in its own worktree, on its own branch, and commit after each passing test and each function implemented (see Commits above).

5. Once an **implementer subagent** completes, integrate its work onto the feature branch with an **integrator subagent** (local git only: cherry-pick or merge the worktree branch into the feature branch). This is not a GitHub/GitLab pull request. If integration produced a distinct slice not already committed, commit it.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, run the project's full test suite on the feature branch. Fix failures with a single **implementer subagent** until the tests pass, committing each fix slice (see Commits above).

8. Clean up all **implementer subagent** worktrees.

## Done

Stop here. Hand back: feature branch name, what was implemented, and that tests pass.

PR creation, PR description, and any merge of a pull request belong exclusively to `open-pr` (and a human). This skill does not create, update, mark ready, or merge a pull request.
