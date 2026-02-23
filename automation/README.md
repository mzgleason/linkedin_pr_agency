# Automation Overview

This automation is approval-gated and manual-posting only.
It can optionally email drafts or a weekly interview to you for review.

## Files
- `.env.template` - auth placeholders (reserved for future)
- `config.json` - automation settings
- `runbook.md` - step-by-step process
- `email_draft.py` - send a draft to your email (explicit confirmation required)
- `weekly_intake_email.py` - send Friday interview questions (explicit confirmation required)
- `agency_orchestrator.py` - end-to-end interview + drafting loop

## Publish a Draft
1. Ensure the draft is approved.
2. Manually copy/paste into LinkedIn and post.

## Email a Draft (OAuth)
1. In Google Cloud Console, create OAuth Desktop app credentials.
2. Save the downloaded JSON as `client_secret.json` in this folder.
3. Copy `.env.template` to `.env` and fill `GMAIL_USER`, `EMAIL_TO`.
4. Install dependencies:
   - `python -m pip install -r requirements.txt`
5. Generate a token (one-time):
   - `python gmail_oauth_token.py`
6. Send:
   - `python email_draft_oauth.py --file ..\\drafts\\2026-02-23_long_learning_in_public.md --confirm SEND`

Note: The token now includes read access for interview replies. Re-run
`python gmail_oauth_token.py` after updating scopes.

## Email the Friday Interview (OAuth)
Use the same OAuth setup as above, then send:
- `python weekly_intake_email.py --confirm SEND`

## Run the Full Weekly Loop
This script sends the Friday interview, waits for replies, drafts the series,
requests one feedback round, and applies revisions.
- `python agency_orchestrator.py`

## Local Stage Runner (Mocks)
Run individual stages with deterministic mocks:
- `python stage_runner.py all --use-mocks`
- `python stage_runner.py interview --use-mocks`
- `python stage_runner.py storyboard --use-mocks`
- `python stage_runner.py drafts --use-mocks`
- `python stage_runner.py feedback --use-mocks`
- `python stage_runner.py approvals --use-mocks`
- `python stage_runner.py reminders --use-mocks`
- `python stage_runner.py archive --use-mocks`
- `python stage_runner.py all --use-mocks --cleanup`

Autonomous behavior:
- On Fri/Sat/Sun, sends an action-needed email with full draft text
  if next week's three posts are not fully drafted or approved.
- On scheduled post dates, emails the approved post content for manual
  copy/paste publishing.
- After all three reminders are sent, drafts are cleaned up and a weekly
  memory entry is recorded.

## Observability
- Scheduled pipelines run credential preflight before orchestration.
- If required variables or token fields are missing/invalid, the job fails fast
  with a clear error.
- Pipeline artifacts always include:
  - `automation/last_health_report.json`
  - `automation/last_orchestrator_report.json`
- Use these artifacts to diagnose expired or malformed OAuth tokens.

Required env vars:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (chat-completions compatible, or set `openai_model` in `config.json`)

## Optional: Schedule Friday Email (Windows Task Scheduler)
Example command (set to 12:00 ET):
- `schtasks /Create /SC WEEKLY /D FRI /TN "LinkedIn PR Friday Interview" /TR "python C:\Users\markz\linkedin_pr_agency\automation\weekly_intake_email.py --confirm SEND" /ST 12:00`

## GitLab CI (Recommended Always-On)
1. Add GitLab CI variables (masked):
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `GMAIL_USER`
   - `EMAIL_TO`
   - `GMAIL_OAUTH_TOKEN_JSON` (full contents of `token.json`)
2. Generate `token.json` locally after expanding scopes, then paste it into
   `GMAIL_OAUTH_TOKEN_JSON`.
3. Use the provided `.gitlab-ci.yml` to run quality gates on push/MR and run
   `agency_orchestrator.py` on schedule.
