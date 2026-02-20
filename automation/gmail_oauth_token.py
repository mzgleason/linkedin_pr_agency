import os
from pathlib import Path

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

from gmail_shared import SCOPES


def load_env():
    load_dotenv()
    user = os.getenv("GMAIL_USER", "").strip()
    client_secrets = os.getenv("GMAIL_OAUTH_CLIENT_SECRETS", "").strip()
    token_path = os.getenv("GMAIL_OAUTH_TOKEN", "").strip()
    if not user or not client_secrets or not token_path:
        raise RuntimeError(
            "Missing GMAIL_USER, GMAIL_OAUTH_CLIENT_SECRETS, or GMAIL_OAUTH_TOKEN in .env"
        )
    return user, client_secrets, token_path


def main():
    _, client_secrets, token_path = load_env()

    secrets_path = Path(client_secrets)
    if not secrets_path.exists():
        raise SystemExit(f"Client secrets file not found: {secrets_path}")

    flow = InstalledAppFlow.from_client_secrets_file(
        str(secrets_path), scopes=SCOPES
    )
    creds = flow.run_local_server(port=0)

    Path(token_path).write_text(creds.to_json(), encoding="utf-8")
    print({"token_saved_to": token_path})


if __name__ == "__main__":
    main()
