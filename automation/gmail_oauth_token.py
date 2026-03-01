import os
import argparse
from pathlib import Path

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

from gmail_shared import SCOPES

BASE_DIR = Path(__file__).resolve().parent


def load_env():
    # Always prefer automation/.env so execution works from any cwd.
    load_dotenv(BASE_DIR / ".env")
    user = os.getenv("GMAIL_USER", "").strip()
    client_secrets = os.getenv("GMAIL_OAUTH_CLIENT_SECRETS", "").strip()
    token_path = os.getenv("GMAIL_OAUTH_TOKEN", "").strip()
    if not user or not client_secrets or not token_path:
        raise RuntimeError(
            "Missing GMAIL_USER, GMAIL_OAUTH_CLIENT_SECRETS, or GMAIL_OAUTH_TOKEN in .env"
        )
    return user, client_secrets, token_path


def resolve_path(path_text):
    path = Path(path_text).expanduser()
    if path.is_absolute():
        return path
    return (BASE_DIR / path).resolve()


def main():
    parser = argparse.ArgumentParser(description="Generate Gmail OAuth token.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not auto-open browser; print auth URL in terminal.",
    )
    args = parser.parse_args()

    _, client_secrets, token_path = load_env()

    secrets_path = resolve_path(client_secrets)
    if not secrets_path.exists():
        raise SystemExit(f"Client secrets file not found: {secrets_path}")

    flow = InstalledAppFlow.from_client_secrets_file(
        str(secrets_path), scopes=SCOPES
    )
    creds = flow.run_local_server(port=0, open_browser=not args.no_browser)

    out_path = resolve_path(token_path)
    out_path.write_text(creds.to_json(), encoding="utf-8")
    print({"token_saved_to": str(out_path)})


if __name__ == "__main__":
    main()
