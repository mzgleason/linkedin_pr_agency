# Automation Runbook

## 1) Friday Interview (Weekly)
- Send the interview email:
  `python weekly_intake_email.py --confirm SEND`
- Responses are saved to `../intake_answers.md`.
- Update `../truth_file.md` if needed.
Optional: schedule the Friday email:
`schtasks /Create /SC WEEKLY /D FRI /TN "LinkedIn PR Friday Interview" /TR "python C:\Users\markz\linkedin_pr_agency\automation\weekly_intake_email.py --confirm SEND" /ST 12:00`

## 2) Draft
- Generate a three-part series for next week (Mon/Wed/Fri) into `../drafts/`.
- Use `../templates/weekly_series_brief_template.md` as the brief.
- Run QA checklist from `../checklist.md`.
- Run compliance checks from `../policy_checklist.md`.

## 2.5) Automation Orchestrator
`agency_orchestrator.py` can run steps 1-3 automatically when scheduled.

## 3) Approval Gate
- Log approval in `../approval_log.md`
- Move approved posts into `../publish_queue.md`

## 4) Publish (approval required)
Publishing is manual-only. If you want a review step, email the draft first:
`python email_draft_oauth.py --file ..\\drafts\\<file>.md --confirm SEND`
