---
name: security-secrets-scan
description: "Use after every commit, and again as a final gate before opening a PR. Scans the diff for hardcoded secrets, API keys, credentials, and any real (non-anonymized) system names, hostnames, or customer/business data that should not appear in the codebase, given this project handles banking IT system mappings."
---

# Security secrets scan

Hard gate after every commit and again before opening a PR. Do not proceed to the next workflow step until this scan reports **clean** or every finding is resolved and the scan re-run.

## When to run

1. **After every commit** — scan that commit's diff (`git show --format= --unified=0 HEAD` or `git diff HEAD~1...HEAD`).
2. **Before opening a PR** — scan the full branch range against the base (`git diff <base>...HEAD`).

If the user did not name a range, default: last commit after a commit; merge-base with the default branch before a PR.

## What to flag

Scan **added and modified lines only** (ignore pure deletions). Flag anything that should not live in this banking IT mapping codebase:

| Category | Examples |
|---|---|
| Secrets / credentials | API keys, tokens, passwords, private keys, connection strings with credentials, `.env` values, cloud access keys |
| Auth material | Bearer tokens, JWTs that look real, client secrets, certificates with private material |
| Real system identity | Non-anonymized production hostnames, FQDNs, internal URLs, IP addresses tied to real environments |
| Business / customer data | Real customer names, account identifiers, org-specific system names that are not placeholders or fixtures |

**Do not flag** obvious placeholders and anonymized stand-ins: `example.com`, `localhost`, `***`, `REDACTED`, `YOUR_API_KEY`, `acme-bank-test`, fixture IDs clearly fake, docs that say "e.g.".

When unsure whether a name is real vs anonymized, **flag it** and say why — this project maps banking IT systems; false positives are cheaper than a leak.

## Process

1. Resolve the diff range (commit vs PR gate above). Confirm the range is non-empty.
2. Read the full diff. For each suspect line, record file path and line number in the **new** file (from the diff hunk headers).
3. Classify each finding with the category above and a one-line reason.
4. Emit the output format below.
5. If there are findings: **stop**. Tell the user this is a hard gate; list what must be fixed (remove, redact, anonymize, or move to secret store / env). Do not open a PR, push further workflow, or treat the commit as done until a re-scan is **clean**.

## Output

Findings with file and line, or `clean` if none found:

```markdown
## Security secrets scan

**Range:** `<diff range>`
**Result:** `clean` | `blocked`

### Findings
- `path/to/file:LINE` — [category] reason

(or: no findings)
```

If clean, the entire findings section may be replaced with a single line: `clean`.
