# HANDOFF

Last updated: 2026-02-20

## Project
- Name: LinkedIn PR Agency
- Local path: `C:\Users\markz\linkedin_pr_agency`
- GitLab: `https://gitlab.com/mark.z.gleason-group/linkedin_pr_agency.git`
- Default branch: `main`

## Purpose
- Run an autonomous weekly LinkedIn content workflow.
- Target behavior:
  - Weekend goal is full draft + approval readiness for next week.
  - On scheduled post days, email approved draft for manual LinkedIn posting.

## Runtime And Deployment
- App: Next.js (`npm run dev`)
- Database: Postgres + Prisma (`docker compose up -d`, then `npm run prisma:migrate`)
- CI/CD: GitLab pipelines (`.gitlab-ci.yml`) run lint + build on push/MR only (no scheduled orchestrator jobs).

## Current State
- Legacy Python email automation has been removed.
- This repo is now focused on the phone-first approval/feedback web app.

## Operating Policy
- Iris executes autonomously, including commit and push.
- Human role is outcome review and strategic direction.
- Escalate only on blockers (auth, platform permissions, external outage).

## Context And AGENTS
- Workspace-level agent policy is in `C:\Users\markz\AGENTS.md`.
- That file is available when this workspace is opened, but chat memory is not durable across sessions.
- Durable project state should always be updated in this `HANDOFF.md`.
