import argparse
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from gmail_shared import SCOPES


def load_env():
    load_dotenv()
    user = os.getenv("GMAIL_USER", "").strip()
    email_to = os.getenv("EMAIL_TO", "").strip()
    token_path = os.getenv("GMAIL_OAUTH_TOKEN", "").strip()
    if not user or not email_to or not token_path:
        raise RuntimeError("Missing GMAIL_USER, EMAIL_TO, or GMAIL_OAUTH_TOKEN in .env")
    return user, email_to, token_path


def read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    if text.startswith("# "):
        lines = text.splitlines()
        text = "\n".join(lines[1:]).strip()
    return text


def build_message(sender: str, to: str, subject: str, body: str) -> dict:
    raw = f"From: {sender}\r\nTo: {to}\r\nSubject: {subject}\r\n\r\n{body}"
    encoded = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")
    return {"raw": encoded}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to draft markdown file")
    parser.add_argument("--subject", default="LinkedIn Draft", help="Email subject")
    parser.add_argument(
        "--confirm",
        required=True,
        help="Type SEND to confirm emailing",
    )
    args = parser.parse_args()

    if args.confirm.strip().upper() != "SEND":
        raise SystemExit("Confirmation missing. Use --confirm SEND to email.")

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"Draft not found: {path}")

    text = read_text(path)
    if len(text) == 0:
        raise SystemExit("Draft is empty.")

    user, email_to, token_path = load_env()
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    try:
        service = build("gmail", "v1", credentials=creds)
        message = build_message(user, email_to, args.subject, text)
        sent = service.users().messages().send(userId="me", body=message).execute()
        print({"id": sent.get("id"), "to": email_to, "file": str(path)})
    except HttpError as err:
        raise SystemExit(f"Gmail API error: {err}")


if __name__ == "__main__":
    main()
