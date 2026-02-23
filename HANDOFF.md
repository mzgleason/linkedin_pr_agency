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
- CI/CD: GitLab pipelines (`.gitlab-ci.yml`)
- Stages: `quality` -> `build` -> `orchestrate`
- `orchestrate` runs on scheduled pipelines only.
- Pipeline artifacts to inspect after runs:
  - `automation/last_health_report.json`
  - `automation/last_orchestrator_report.json`

## Required Variables (names only)
Set in GitLab CI/CD variables:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GMAIL_USER`
- `EMAIL_TO`
- `GMAIL_OAUTH_TOKEN_JSON` (full token JSON text, not a filename)

## Key Files
- Orchestration: `automation/agency_orchestrator.py`
- Credential preflight: `automation/preflight_credentials.py`
- Auto-commit: `automation/commit_changes.py`
- Run docs: `automation/README.md`

## Current State
- Repo is active with scheduled pipeline-driven orchestration.
- Weekend nudge and approval flow exists in orchestrator.
- Main failure risk remains OAuth token expiry/invalid token payload.

## How To Validate Quickly
1. Run/inspect latest scheduled pipeline in GitLab.
2. Confirm `quality`, `build`, `orchestrate` all green.
3. Download artifacts and verify health/orchestrator reports.
4. Confirm receipt of expected agency email behavior for current schedule window.

## Next Priorities
1. Add token-expiry warning email before hard expiry.
2. Improve approval email UX (include full draft content + clear reply commands).
3. Keep schedule cadence tuned for Fri/Sat/Sun feedback loops.

## Operating Policy
- Iris executes autonomously, including commit and push.
- Human role is outcome review and strategic direction.
- Escalate only on blockers (auth, platform permissions, external outage).

## Context And AGENTS
- Workspace-level agent policy is in `C:\Users\markz\AGENTS.md`.
- That file is available when this workspace is opened, but chat memory is not durable across sessions.
- Durable project state should always be updated in this `HANDOFF.md`.
