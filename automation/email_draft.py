import argparse
import os
from pathlib import Path
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv


def load_env():
    load_dotenv()
    user = os.getenv("GMAIL_USER", "").strip()
    app_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    email_to = os.getenv("EMAIL_TO", "").strip()
    if not user or not app_password or not email_to:
        raise RuntimeError(
            "Missing GMAIL_USER, GMAIL_APP_PASSWORD, or EMAIL_TO in .env"
        )
    return user, app_password, email_to


def read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    # Strip a leading markdown title if present.
    if text.startswith("# "):
        lines = text.splitlines()
        text = "\n".join(lines[1:]).strip()
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to draft markdown file")
    parser.add_argument(
        "--subject",
        default="LinkedIn Draft",
        help="Email subject",
    )
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

    user, app_password, email_to = load_env()

    msg = EmailMessage()
    msg["Subject"] = args.subject
    msg["From"] = user
    msg["To"] = email_to
    msg.set_content(text)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(user, app_password)
        smtp.send_message(msg)

    print({"sent_to": email_to, "subject": args.subject, "file": str(path)})


if __name__ == "__main__":
    main()
