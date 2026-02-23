import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import agency_orchestrator as ao

from mocks.gmail_mock import MockGmail
from mocks.openai_mock import MockOpenAI


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "default.json"


def load_fixtures(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_fixtures(fixtures):
    if not isinstance(fixtures, dict):
        return {}
    fixtures.setdefault(
        "interview_reply",
        "This week we tightened our review loop and removed a noisy handoff.",
    )
    fixtures.setdefault("storyboard_reply", "APPROVE STORYBOARD")
    fixtures.setdefault(
        "draft_reply",
        "Please tighten the opening of post 2 and add one concrete line.",
    )
    fixtures.setdefault("final_approval_reply", "Approved. Looks good.")
    fixtures.setdefault("weekend_reply", "APPROVE ALL")
    return fixtures


def parse_week_start(value):
    if not value:
        return None
    return datetime.fromisoformat(value).date()


def infer_next_week_start_from_drafts():
    drafts_dir = ROOT / "drafts"
    if not drafts_dir.exists():
        return None
    dates = []
    for path in drafts_dir.glob("*.md"):
        match = re.search(r"(20\d{2}-\d{2}-\d{2})_", path.name)
        if match:
            try:
                dates.append(datetime.fromisoformat(match.group(1)).date())
            except ValueError:
                continue
    if not dates:
        return None
    latest = max(dates)
    return ao.next_monday(latest)


def build_now(week_start, stage, config):
    tz = ZoneInfo(config["timezone"])
    if not week_start:
        now = datetime.now(tz)
        return now
    monday = datetime.combine(week_start, datetime.min.time(), tzinfo=tz)
    default_time = config.get("default_post_time", "09:00")
    hour, minute = ao.parse_time_hhmm(default_time)

    if stage == "interview":
        return monday - timedelta(days=3) + timedelta(hours=12)
    if stage == "approvals":
        return monday - timedelta(days=2) + timedelta(hours=12)
    if stage == "reminders":
        return monday + timedelta(hours=hour, minutes=minute)
    if stage == "archive":
        return monday + timedelta(days=5, hours=hour, minutes=minute)
    return monday + timedelta(hours=hour, minutes=minute)


def patch_clients(fixtures):
    gmail = MockGmail(fixtures)
    openai_fixtures = fixtures.get("openai", {}) if isinstance(fixtures, dict) else {}
    openai = MockOpenAI(openai_fixtures)
    ao.send_email = gmail.send_email
    ao.latest_reply_in_thread = gmail.latest_reply_in_thread
    ao.find_latest_message_for_subject = gmail.find_latest_message_for_subject
    ao.latest_message_id_in_thread = gmail.latest_message_id_in_thread
    ao.chat_complete = openai.chat_complete
    return gmail, openai


def patch_flow_controls():
    ao.maybe_send_weekend_nudge = lambda *args, **kwargs: False
    ao.maybe_process_weekend_approval_reply = lambda *args, **kwargs: False
    ao.maybe_archive_and_prune_completed_weeks = lambda *args, **kwargs: False


def patch_weekend_nudge_only():
    ao.maybe_send_weekend_nudge = lambda *args, **kwargs: False
    ao.maybe_process_weekend_approval_reply = lambda *args, **kwargs: False


def reset_state():
    ao.save_state(ao.STATE_DEFAULTS.copy())


def collect_outputs():
    draft_files = sorted([p for p in (ROOT / "drafts").glob("*.md")])
    state_path = ROOT / "automation" / "state.json"
    return {
        "drafts": [str(p.relative_to(ROOT)).replace("\\", "/") for p in draft_files],
        "state_path": str(state_path.relative_to(ROOT)).replace("\\", "/")
        if state_path.exists()
        else "",
    }


def print_report():
    outputs = collect_outputs()
    state = ao.load_state()
    print("\nReport:")
    print(f"- status: {state.get('status')}")
    print(f"- week_start: {state.get('week_start')}")
    print(f"- storyboard_file: {state.get('storyboard_file')}")
    print(f"- draft_files: {len(state.get('draft_files', []))}")
    for file_path in state.get("draft_files", []):
        print(f"  - {file_path}")
    print(f"- drafts_on_disk: {len(outputs['drafts'])}")
    for file_path in outputs["drafts"]:
        print(f"  - {file_path}")
    if outputs["state_path"]:
        print(f"- state: {outputs['state_path']}")


def run_stage(stage, week_start, use_mocks, fixtures_path, report=False, skip_weekend_nudge=False):
    fixtures = normalize_fixtures(load_fixtures(fixtures_path))
    if use_mocks:
        patch_clients(fixtures)
        patch_flow_controls()
    elif skip_weekend_nudge:
        patch_weekend_nudge_only()
    config = ao.load_config()
    if stage == "interview":
        run_through_storyboard(week_start, config, stop_after_storyboard=True)
    elif stage == "storyboard":
        run_through_storyboard(week_start, config, stop_after_storyboard=True)
    elif stage == "drafts":
        run_through_drafts(week_start, config)
    elif stage == "feedback":
        run_through_feedback(week_start, config)
    elif stage == "approvals":
        run_through_approvals(week_start, config)
    elif stage == "reminders":
        run_through_reminders(week_start, config)
    elif stage == "archive":
        run_through_archive(week_start, config)
    else:
        now = build_now(week_start, stage, config)
        ao.run_once(now)
    print(f"Stage '{stage}' executed")
    if report:
        print_report()


def run_all(week_start, use_mocks, fixtures_path, include_archive=False, report=False, skip_weekend_nudge=False):
    fixtures = normalize_fixtures(load_fixtures(fixtures_path))
    if use_mocks:
        patch_clients(fixtures)
        patch_flow_controls()
    elif skip_weekend_nudge:
        patch_weekend_nudge_only()
    config = ao.load_config()
    if not run_through_drafts(week_start, config):
        print("Warning: did not reach draft generation stage.")
        if report:
            print_report()
        return
    if not run_through_feedback(week_start, config):
        print("Warning: did not reach feedback stage.")
        if report:
            print_report()
        return
    if not run_through_approvals(week_start, config):
        print("Warning: did not reach approval stage.")
        if report:
            print_report()
        return
    run_through_reminders(week_start, config)
    if include_archive:
        run_through_archive(week_start, config)
    print("Stage 'all' executed with mocks" if use_mocks else "Stage 'all' executed")
    if report:
        print_report()


def resolve_week_start(week_start, config):
    tz = ZoneInfo(config["timezone"])
    if week_start:
        return week_start
    return ao.week_dates(datetime.now(tz))[0]


def friday_noon_for_week(week_start, config):
    tz = ZoneInfo(config["timezone"])
    friday_noon = datetime.combine(week_start, datetime.min.time(), tzinfo=tz) - timedelta(days=3)
    return friday_noon.replace(hour=12, minute=0, second=0, microsecond=0)


def run_through_storyboard(week_start, config, stop_after_storyboard=True):
    week_start = resolve_week_start(week_start, config)
    friday_noon = friday_noon_for_week(week_start, config)
    ok = run_until_status(friday_noon, "waiting_for_storyboard_approval")
    if stop_after_storyboard:
        return ok
    return ok


def run_through_drafts(week_start, config):
    week_start = resolve_week_start(week_start, config)
    friday_noon = friday_noon_for_week(week_start, config)
    return run_until_status(friday_noon, "waiting_for_feedback")


def run_through_feedback(week_start, config):
    if not run_through_drafts(week_start, config):
        return False
    friday_noon = friday_noon_for_week(resolve_week_start(week_start, config), config)
    return run_until_status(friday_noon, "final_sent")


def run_through_approvals(week_start, config):
    friday_noon = friday_noon_for_week(resolve_week_start(week_start, config), config)
    return run_until_status(friday_noon, "complete")


def run_through_reminders(week_start, config):
    week_start = resolve_week_start(week_start, config)
    hour, minute = ao.parse_time_hhmm(config.get("default_post_time", "09:00"))
    tz = ZoneInfo(config["timezone"])
    monday = datetime.combine(week_start, datetime.min.time(), tzinfo=tz).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    wednesday = monday + timedelta(days=2)
    friday = monday + timedelta(days=4)
    ao.run_once(monday)
    ao.run_once(wednesday)
    ao.run_once(friday)


def run_through_archive(week_start, config):
    run_through_reminders(week_start, config)
    week_start = resolve_week_start(week_start, config)
    ao.append_week_memory(week_start.isoformat() if hasattr(week_start, "isoformat") else str(week_start))
    ao.prune_week_artifacts(week_start.isoformat() if hasattr(week_start, "isoformat") else str(week_start))
    state = ao.load_state()
    archived = set(state.get("archived_weeks", []))
    archived.add(week_start.isoformat() if hasattr(week_start, "isoformat") else str(week_start))
    state["archived_weeks"] = sorted(archived)
    ao.save_state(state)


def run_until_status(now, desired_status, max_steps=12):
    for _ in range(max_steps):
        ao.run_once(now)
        state = ao.load_state()
        if state.get("status") == desired_status:
            return True
    state = ao.load_state()
    print(f"Warning: status '{state.get('status')}' did not reach '{desired_status}'.")
    return False


def build_parser():
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument(
        "--fixtures",
        default=str(DEFAULT_FIXTURES),
        help="Path to fixtures JSON for mock replies and outputs.",
    )
    parent.add_argument("--week-start", default="", help="Week start date (YYYY-MM-DD).")
    parent.add_argument("--use-mocks", action="store_true", help="Use mock Gmail/OpenAI.")
    parent.add_argument("--no-mocks", action="store_true", help="Disable mocks.")
    parent.add_argument("--reset-state", action="store_true", help="Reset state.json before run.")
    parent.add_argument("--keep-state", action="store_true", help="Keep existing state.json.")
    parent.add_argument(
        "--include-archive",
        action="store_true",
        help="Include archive step when running all.",
    )
    parent.add_argument(
        "--cleanup",
        action="store_true",
        help="Clean up drafts and record weekly memory after reminders.",
    )
    parent.add_argument(
        "--report",
        action="store_true",
        help="Print a summary of state and outputs after the run.",
    )
    parent.add_argument(
        "--skip-weekend-nudge",
        action="store_true",
        help="Skip weekend nudge logic for this run.",
    )

    parser = argparse.ArgumentParser(description="Run local LinkedIn PR agency stages.")
    subparsers = parser.add_subparsers(dest="stage", required=True)
    subparsers.add_parser("all", parents=[parent])
    subparsers.add_parser("interview", parents=[parent])
    subparsers.add_parser("storyboard", parents=[parent])
    subparsers.add_parser("drafts", parents=[parent])
    subparsers.add_parser("feedback", parents=[parent])
    subparsers.add_parser("approvals", parents=[parent])
    subparsers.add_parser("reminders", parents=[parent])
    subparsers.add_parser("archive", parents=[parent])
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    fixtures_path = Path(args.fixtures)
    week_start = parse_week_start(args.week_start)
    use_mocks = args.use_mocks or not args.no_mocks
    reset = args.reset_state or (use_mocks and not args.keep_state)

    if use_mocks and week_start is None:
        inferred = infer_next_week_start_from_drafts()
        if inferred:
            week_start = inferred

    if reset:
        reset_state()
    if args.stage == "all":
        run_all(
            week_start,
            use_mocks,
            fixtures_path,
            include_archive=args.include_archive or args.cleanup,
            report=args.report,
            skip_weekend_nudge=args.skip_weekend_nudge,
        )
        return
    run_stage(
        args.stage,
        week_start,
        use_mocks,
        fixtures_path,
        report=args.report,
        skip_weekend_nudge=args.skip_weekend_nudge,
    )


if __name__ == "__main__":
    main()
