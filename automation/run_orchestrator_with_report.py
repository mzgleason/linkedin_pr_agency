import json
import traceback
from datetime import datetime, timezone
from pathlib import Path

import agency_orchestrator


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "automation" / "last_orchestrator_report.json"


def write_report(ok, error=""):
    payload = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "ok": ok,
        "error": error,
    }
    REPORT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main():
    try:
        agency_orchestrator.main()
        write_report(True, "")
    except Exception:
        write_report(False, traceback.format_exc())
        raise


if __name__ == "__main__":
    main()
