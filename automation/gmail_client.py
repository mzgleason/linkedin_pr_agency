import os
import base64
from typing import Optional, Tuple
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from gmail_shared import SCOPES, extract_plain_text, extract_header, clean_reply_text, parse_sender


def load_env():
    load_dotenv()
    user = os.getenv("GMAIL_USER", "").strip()
    email_to = os.getenv("EMAIL_TO", "").strip()
    token_path = os.getenv("GMAIL_OAUTH_TOKEN", "").strip()
    if not token_path:
        default_token = Path(__file__).resolve().parent / "token.json"
        if default_token.exists():
            token_path = str(default_token)
    if not user or not email_to or not token_path:
        raise RuntimeError("Missing GMAIL_USER, EMAIL_TO, or GMAIL_OAUTH_TOKEN.")
    return user, email_to, token_path


def build_service():
    _, _, token_path = load_env()
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    return build("gmail", "v1", credentials=creds)


def build_message(sender: str, to: str, subject: str, body: str, thread_id: Optional[str] = None) -> dict:
    raw = f"From: {sender}\r\nTo: {to}\r\nSubject: {subject}\r\n\r\n{body}"
    encoded = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")
    message = {"raw": encoded}
    if thread_id:
        message["threadId"] = thread_id
    return message


def send_email(subject: str, body: str, thread_id: Optional[str] = None) -> Tuple[str, str]:
    user, email_to, _ = load_env()
    service = build_service()
    message = build_message(user, email_to, subject, body, thread_id=thread_id)
    try:
        sent = service.users().messages().send(userId="me", body=message).execute()
    except HttpError as err:
        raise RuntimeError(f"Gmail API error: {err}") from err
    return sent.get("id", ""), sent.get("threadId", "")


def fetch_thread(thread_id: str):
    service = build_service()
    return service.users().threads().get(userId="me", id=thread_id, format="full").execute()


def latest_reply_in_thread(thread_id: str, expected_sender: str, after_message_id: Optional[str] = None):
    thread = fetch_thread(thread_id)
    messages = thread.get("messages", [])
    for msg in reversed(messages):
        msg_id = msg.get("id", "")
        if after_message_id and msg_id == after_message_id:
            break
        headers = msg.get("payload", {}).get("headers", [])
        sender = parse_sender(headers)
        if sender and sender != expected_sender.lower().strip():
            continue
        payload = msg.get("payload", {})
        text = extract_plain_text(payload)
        text = clean_reply_text(text)
        if text:
            return msg_id, text
    return None, ""


def extract_subject_from_thread(thread_id: str):
    thread = fetch_thread(thread_id)
    messages = thread.get("messages", [])
    if not messages:
        return ""
    headers = messages[0].get("payload", {}).get("headers", [])
    return extract_header(headers, "Subject")


def latest_message_id_in_thread(thread_id: str, expected_sender: Optional[str] = None):
    thread = fetch_thread(thread_id)
    expected = (expected_sender or "").lower().strip()
    for msg in reversed(thread.get("messages", [])):
        headers = msg.get("payload", {}).get("headers", [])
        sender = parse_sender(headers)
        if expected and sender != expected:
            continue
        return msg.get("id", "")
    return ""


def find_latest_message_for_subject(subject: str, max_results: int = 10):
    service = build_service()
    query = f'subject:"{subject}"'
    try:
        resp = (
            service.users()
            .messages()
            .list(
                userId="me",
                q=query,
                maxResults=max_results,
                includeSpamTrash=False,
            )
            .execute()
        )
    except HttpError as err:
        raise RuntimeError(f"Gmail API error: {err}") from err

    best = None
    for item in resp.get("messages", []):
        msg_id = item.get("id", "")
        if not msg_id:
            continue
        meta = (
            service.users()
            .messages()
            .get(
                userId="me",
                id=msg_id,
                format="metadata",
                metadataHeaders=["Subject", "From"],
            )
            .execute()
        )
        headers = meta.get("payload", {}).get("headers", [])
        msg_subject = extract_header(headers, "Subject")
        if subject not in msg_subject:
            continue
        internal_date = int(meta.get("internalDate", "0"))
        candidate = {
            "message_id": msg_id,
            "thread_id": meta.get("threadId", ""),
            "internal_date": internal_date,
            "sender": parse_sender(headers),
            "subject": msg_subject,
        }
        if not best or candidate["internal_date"] > best["internal_date"]:
            best = candidate
    return best
