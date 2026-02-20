import argparse
import base64
import os
from datetime import date, timedelta
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


def next_monday(from_date: date) -> date:
    days_until = (0 - from_date.weekday() + 7) % 7
    if days_until == 0:
        days_until = 7
    return from_date + timedelta(days=days_until)


def build_message(sender: str, to: str, subject: str, body: str) -> dict:
    raw = f"From: {sender}\r\nTo: {to}\r\nSubject: {subject}\r\n\r\n{body}"
    encoded = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")
    return {"raw": encoded}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--questions",
        default="..\\intake.md",
        help="Path to weekly interview questions",
    )
    parser.add_argument(
        "--subject",
        default="",
        help="Email subject (auto-generated if omitted)",
    )
    parser.add_argument(
        "--confirm",
        required=True,
        help="Type SEND to confirm emailing",
    )
    args = parser.parse_args()

    if args.confirm.strip().upper() != "SEND":
        raise SystemExit("Confirmation missing. Use --confirm SEND to email.")

    questions_path = Path(args.questions)
    if not questions_path.exists():
        raise SystemExit(f"Questions file not found: {questions_path}")

    questions = read_text(questions_path)
    if len(questions) == 0:
        raise SystemExit("Questions file is empty.")

    week_start = next_monday(date.today()).isoformat()
    subject = args.subject.strip() or f"Friday Interview - LinkedIn Series (Week of {week_start})"

    body = (
        "Quick interview to create next week's three-part LinkedIn series.\n"
        f"Week of: {week_start}\n\n"
        "Please reply in plain text. Keep answers concise and specific.\n\n"
        f"{questions}\n"
    )

    user, email_to, token_path = load_env()
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    try:
        service = build("gmail", "v1", credentials=creds)
        message = build_message(user, email_to, subject, body)
        sent = service.users().messages().send(userId="me", body=message).execute()
        print({"id": sent.get("id"), "to": email_to, "questions": str(questions_path)})
    except HttpError as err:
        raise SystemExit(f"Gmail API error: {err}")


if __name__ == "__main__":
    main()
