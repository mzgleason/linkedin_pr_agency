# GitLab Setup (Always-On)

## 1) Initialize This Folder As Its Own Git Repo
Run in `linkedin_pr_agency`:

```powershell
git init
git branch -m main
git add .
git commit -m "Initial LinkedIn PR agency setup"
```

Then create an empty GitLab project and push:

```powershell
git remote add origin https://gitlab.com/<namespace>/linkedin_pr_agency.git
git push -u origin main
```

## 2) Add CI Variables (Masked)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GMAIL_USER`
- `EMAIL_TO`
- `GMAIL_OAUTH_TOKEN_JSON` = full contents of local `automation/token.json`

## 3) Schedule The Pipeline
Create two schedules:
1. Friday at 12:00 PM America/New_York
2. Daily at 12:00 PM America/New_York (to process replies and revisions)

## 4) OAuth Token Setup
Re-run `python automation/gmail_oauth_token.py` locally after scope updates.
Paste the resulting `automation/token.json` into `GMAIL_OAUTH_TOKEN_JSON`.

## 5) Branch Protection
- Protect `main`
- Require merge requests for changes
- Restrict pipeline schedules to Maintainers

## 6) Failure Notifications
- In GitLab, set notification level for this project to receive pipeline failure
  alerts.
- On any failed scheduled run, open the `orchestrate` job artifacts:
  - `automation/last_health_report.json` (credential/token checks)
  - `automation/last_orchestrator_report.json` (runtime exception details)
