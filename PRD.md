# LinkedIn PR Agency Automation PRD

## Goals
- Run a weekly, approval-gated LinkedIn content workflow without manual orchestration.
- Guarantee feedback replies update drafts reliably.
- Provide deterministic local tests for every automation stage.
- Keep publishing manual-only with clear reminders.

## Non-goals
- No automatic LinkedIn posting.
- No new external integrations beyond Gmail and OpenAI.
- No automated scheduling changes beyond the existing GitLab schedules.

## User stories
- As the owner, I receive a Friday interview at lunch and can reply from email.
- As the owner, I review a storyboard before posts are drafted.
- As the owner, I reply with feedback and see updated drafts.
- As the owner, I approve drafts via email and stop receiving approval nudges.
- As the owner, I receive Monday/Wednesday/Friday reminders to post.
- As the owner, I can run the entire flow locally with mocks.

## Acceptance criteria
- Interview replies create `intake_answers.md` and a storyboard file.
- Storyboard approvals create three draft files in `drafts/`.
- Any non-approval feedback reply triggers draft revisions.
- Approval replies update in-run state for the week (no approval log retained).
- Reminder emails only send after the configured post time.
- Stage runner can execute the full flow with mocks.

## Edge cases
- No reply from the owner: system remains idle at that stage.
- Replies lacking approval keywords still trigger revisions.
- Missing drafts prevent approval emails from logging approvals.
- Reply sender varies: accepted when sender policy is `any`.
- Duplicate approvals are ignored in the log.

## Performance requirements
- Full orchestration should complete within typical CI job limits.
- Email parsing should be linear with thread size.

## Security requirements
- Do not log secrets or OAuth tokens.
- Use existing CI variable masking for API keys and tokens.

## Rollout plan
- Add local stage runner and mocks.
- Update config, orchestration logic, and tests.
- Validate locally, then rely on CI runs.

## Observability plan
- Maintain `last_health_report.json` and `last_orchestrator_report.json`.
- Add stage-level logs in runner output for local validation.
