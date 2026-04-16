---
name: linear-defaults-linkedin-pr-agency
description: "Linear defaults for the `linkedin_pr_agency` public SaaS project in Linear (workspace/team/project/assignee/backlog + suggested labels). Use whenever creating, triaging, or updating Linear issues for this repo so Codex uses the correct project and avoids re-asking setup questions."
---

# Linear Defaults: LinkedIn PR Agency (Public SaaS)

Use these defaults whenever creating or triaging Linear work for this repo, unless the user explicitly overrides.

## Defaults

- Workspace: `mzg-product-playbooks`
- Team: `Mzg-product-playbooks` (key: `MZG`, teamId: `ee31483d-12ff-478a-bcfd-f621dbe41c74`)
- Project: `linkedin_pr_agency` (projectId: `42007b14-2f75-42f1-bcef-34c45ef90e50`)
- Assignee: unassigned (`assignee = null`)
- Location: backlog (no cycle)

## Suggested labels

Prefer adding 1–3 labels per issue from:
- `security`
- `infra`
- `billing`
- `reliability`
- `product`

## Public SaaS guardrails

For new tickets, explicitly consider:
- Multi-tenant data isolation (per-user scoping in all queries/mutations)
- Abuse prevention + cost controls for AI actions (rate limits + quotas)
- Production concerns (deploy/runbooks, backups, observability)
