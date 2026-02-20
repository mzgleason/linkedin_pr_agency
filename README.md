# LinkedIn PR Agency (Local)

This folder contains the local artifacts to run your LinkedIn PR workflow:

- `truth_file.md`: Approved facts and proof points.
- `content_calendar.md`: Month plan with exact dates.
- `intake_answers.md`: Latest interview responses.
- `drafts/`: Post drafts by week.
- `approval_log.md`: Approval history.
- `checklist.md`: QA + approval gates.
- `gitlab_setup.md`: Always-on GitLab CI setup guide.

Workflow:
1. Update `truth_file.md` with any new approved facts.
2. Run the Friday interview (responses saved to `intake_answers.md`).
3. Draft next week's three-part series in `drafts/`.
4. Review against `checklist.md`.
5. Log approval in `approval_log.md`.
6. Publish only after explicit approval.

GitLab:
1. Follow `gitlab_setup.md` to initialize this folder as its own repository.
2. Push to GitLab and add CI variables.
3. Use scheduled pipelines to run orchestration and auto-commit approved draft updates.
