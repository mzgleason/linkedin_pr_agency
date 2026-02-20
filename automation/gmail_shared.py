import base64
from email.utils import parseaddr


SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
]


def extract_header(headers, name):
    for header in headers or []:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def decode_body(data):
    if not data:
        return ""
    return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")


def extract_plain_text(payload):
    if not payload:
        return ""
    mime_type = payload.get("mimeType", "")
    body = payload.get("body", {})
    if mime_type == "text/plain":
        return decode_body(body.get("data"))
    parts = payload.get("parts", []) or []
    for part in parts:
        if part.get("mimeType") == "text/plain":
            return decode_body(part.get("body", {}).get("data"))
    for part in parts:
        nested = extract_plain_text(part)
        if nested:
            return nested
    return ""


def clean_reply_text(text):
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        if line.strip().startswith(">"):
            continue
        if line.strip().lower().startswith("on ") and "wrote:" in line.lower():
            break
        if line.strip().startswith("From:") and "@" in line:
            break
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def parse_sender(headers):
    value = extract_header(headers, "From")
    _, email = parseaddr(value)
    return email.lower().strip()
