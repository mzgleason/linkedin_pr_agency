# Agent guide (linkedin_pr_agency)

This file defines repo-local conventions for AI agents working in this codebase.

## What this repo is
- Current direction: **Next.js + Prisma + Postgres** web app for a mobile-first approval + drafting workflow.
- Legacy Python automation: removed; keep focus on the web app.

## Source of truth
- Product intent: `PRD.md`
- Approved facts/proof points (legacy but still used): `truth_file.md`, `intake_answers.md`, `content_calendar.md`, `checklist.md`

## Run the app (Windows + Docker Desktop)
1) Start Postgres: `docker compose up -d`
2) Create env: copy `.env.example` → `.env` (optional `OPENAI_API_KEY`, `OPENAI_MODEL`)
3) Install + migrate: `npm install` then `npm run prisma:migrate`
4) Dev server: `npm run dev` (default `http://localhost:3000`)
5) DB health: `GET http://localhost:3000/api/health/db`

## Common scripts
- Lint: `npm run lint`
- Build: `npm run build`
- Prisma: `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:studio`

## Design review screenshots (Playwright)
The repo includes a screenshot-driven review skill:
- Skill docs: `skills/design-review/SKILL.md`
- Capture: `powershell -ExecutionPolicy Bypass -File skills/design-review/scripts/capture.ps1 -BaseUrl http://localhost:3000 -Config skills/design-review/templates/routes.example.json`
- Outputs: `artifacts/design-review/` (PNG + `manifest.json`)

Notes:
- The app must be running before capture.
- For authenticated routes, generate a storage state via `node skills/design-review/scripts/capture.mjs --initAuth` and reference it in the config.

## Guardrails
- Keep changes minimal and aligned with `PRD.md`.
- Don’t introduce new infrastructure unless asked (CI, hosting, auth providers, etc.).
- Prefer small UI improvements + Prisma migrations over large refactors.
- Never hardcode secrets; use `.env` and update `.env.example` when adding new required vars.

## Linear defaults (public SaaS)
When creating/triaging Linear issues for this repo, use:
- Team: `Mzg-product-playbooks` (key: `MZG`)
- Project: `linkedin_pr_agency` (slug: `linkedin-pr-agency-27a0d97d0cf3`)
- Assignee: unassigned
- Location: backlog (no cycle)
- Suggested labels: `security`, `infra`, `billing`, `reliability`, `product`

Prefer the repo skill `skills/linear-defaults/SKILL.md` as the single source of truth for these defaults.
