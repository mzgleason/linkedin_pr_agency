from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "README.md",
    "truth_file.md",
    "content_calendar.md",
    "checklist.md",
    "intake.md",
    ".gitlab-ci.yml",
]


def assert_required_files():
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).exists()]
    if missing:
        raise SystemExit(f"Missing required files: {', '.join(missing)}")


def assert_secrets_not_committed():
    disallowed = {"automation/token.json", "automation/client_secret.json"}
    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    found = [path for path in tracked if path in disallowed]
    if found:
        raise SystemExit(f"Remove local secret files before CI: {', '.join(found)}")


def main():
    assert_required_files()
    assert_secrets_not_committed()


if __name__ == "__main__":
    main()
