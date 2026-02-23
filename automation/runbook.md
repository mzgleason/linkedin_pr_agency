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

## 2.6) Local Stage Runner (Mocks)
Use the local CLI to run any stage with deterministic mocks:
`python stage_runner.py all --use-mocks`
`python stage_runner.py interview --use-mocks`
`python stage_runner.py storyboard --use-mocks`
`python stage_runner.py drafts --use-mocks`
`python stage_runner.py feedback --use-mocks`
`python stage_runner.py approvals --use-mocks`
`python stage_runner.py reminders --use-mocks`
`python stage_runner.py archive --use-mocks`

## 3) Approval Gate
- Move approved posts into `../publish_queue.md`

## 4) Publish (approval required)
Publishing is manual-only. If you want a review step, email the draft first:
`python email_draft_oauth.py --file ..\\drafts\\<file>.md --confirm SEND`

## 5) Cleanup + Memory
After Mon/Wed/Fri reminders are sent, drafts are pruned and a weekly
memory entry (topic/project/learning) is recorded in `automation/weekly_memory.json`.
