import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(cmd):
    subprocess.check_call(cmd, cwd=ROOT)


def has_changes():
    result = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    return bool(result.stdout.strip())


def main():
    if not os.getenv("CI"):
        return
    if not has_changes():
        return

    run(["git", "config", "user.name", "iris-bot"])
    run(["git", "config", "user.email", "iris-bot@users.noreply.gitlab.com"])
    run(["git", "add", "drafts", "intake_answers.md", "automation/state.json"])
    run(["git", "commit", "-m", "iris: weekly series update"])

    server = os.getenv("CI_SERVER_HOST")
    project = os.getenv("CI_PROJECT_PATH")
    branch = os.getenv("CI_COMMIT_BRANCH")
    token = os.getenv("CI_JOB_TOKEN")
    if not all([server, project, branch, token]):
        raise SystemExit("Missing CI variables for git push.")

    remote = f"https://gitlab-ci-token:{token}@{server}/{project}.git"
    try:
        run(["git", "push", remote, f"HEAD:{branch}"])
    except subprocess.CalledProcessError as err:
        # Some GitLab projects disallow CI_JOB_TOKEN push on protected branches.
        # Do not fail orchestration when content generation itself succeeded.
        print(f"warning: auto-push skipped ({err})")


if __name__ == "__main__":
    main()
