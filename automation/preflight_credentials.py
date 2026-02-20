import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "automation" / "last_health_report.json"
TOKEN_PATH = ROOT / "automation" / "token.json"


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def add_result(results, name, ok, detail):
    results.append({"check": name, "ok": ok, "detail": detail})
    return ok


def load_token():
    if not TOKEN_PATH.exists():
        raise RuntimeError(f"Missing token file: {TOKEN_PATH}")
    raw = TOKEN_PATH.read_text(encoding="utf-8").strip()
    if not raw:
        raise RuntimeError("token.json is empty.")
    return json.loads(raw)


def parse_expiry(value):
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def run_checks():
    results = []
    all_ok = True

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model = os.getenv("OPENAI_MODEL", "").strip()
    gmail_user = os.getenv("GMAIL_USER", "").strip()
    email_to = os.getenv("EMAIL_TO", "").strip()

    all_ok &= add_result(results, "OPENAI_API_KEY", bool(openai_key), "present" if openai_key else "missing")
    all_ok &= add_result(results, "OPENAI_MODEL", bool(openai_model), "present" if openai_model else "missing")
    all_ok &= add_result(results, "GMAIL_USER", bool(gmail_user), "present" if gmail_user else "missing")
    all_ok &= add_result(results, "EMAIL_TO", bool(email_to), "present" if email_to else "missing")

    try:
        token = load_token()
        has_refresh = bool(token.get("refresh_token"))
        has_client = bool(token.get("client_id")) and bool(token.get("client_secret"))
        has_token_uri = bool(token.get("token_uri"))
        all_ok &= add_result(
            results,
            "gmail_token.refresh_token",
            has_refresh,
            "present" if has_refresh else "missing (token cannot auto-refresh)",
        )
        all_ok &= add_result(
            results,
            "gmail_token.client_credentials",
            has_client,
            "present" if has_client else "missing client_id/client_secret",
        )
        all_ok &= add_result(
            results,
            "gmail_token.token_uri",
            has_token_uri,
            token.get("token_uri", "missing"),
        )
        expiry = parse_expiry(token.get("expiry"))
        if expiry:
            now = datetime.now(timezone.utc)
            if expiry < now and not has_refresh:
                all_ok &= add_result(
                    results,
                    "gmail_token.expiry",
                    False,
                    f"expired at {expiry.isoformat()} and no refresh_token",
                )
            elif expiry < now and has_refresh:
                all_ok &= add_result(
                    results,
                    "gmail_token.expiry",
                    True,
                    f"expired at {expiry.isoformat()} but refresh_token exists",
                )
            elif expiry < now + timedelta(days=2):
                all_ok &= add_result(
                    results,
                    "gmail_token.expiry",
                    True,
                    f"expires soon at {expiry.isoformat()} (refresh_token exists={has_refresh})",
                )
            else:
                all_ok &= add_result(results, "gmail_token.expiry", True, f"valid until {expiry.isoformat()}")
        else:
            all_ok &= add_result(results, "gmail_token.expiry", True, "no parseable expiry (not fatal)")
    except Exception as exc:
        all_ok &= add_result(results, "gmail_token.load", False, str(exc))

    return all_ok, results


def write_report(ok, results):
    report = {
        "timestamp_utc": iso_now(),
        "ok": ok,
        "results": results,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main():
    ok, results = run_checks()
    write_report(ok, results)
    print(json.dumps({"ok": ok, "checks": results}, indent=2))
    if not ok:
        raise SystemExit("Credential preflight failed. See automation/last_health_report.json.")


if __name__ == "__main__":
    main()
