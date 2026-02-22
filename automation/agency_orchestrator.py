import json
import os
import re
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

from gmail_client import (
    send_email,
    latest_reply_in_thread,
    find_latest_message_for_subject,
    latest_message_id_in_thread,
)
from openai_client import chat_complete


ROOT = Path(__file__).resolve().parents[1]
AUTOMATION_DIR = Path(__file__).resolve().parent
CONFIG_PATH = AUTOMATION_DIR / "config.json"
STATE_PATH = AUTOMATION_DIR / "state.json"
INTAKE_QUESTIONS_PATH = ROOT / "intake.md"
INTAKE_ANSWERS_PATH = ROOT / "intake_answers.md"
TRUTH_FILE_PATH = ROOT / "truth_file.md"
DRAFTS_DIR = ROOT / "drafts"
APPROVAL_LOG_PATH = ROOT / "approval_log.md"


STATE_DEFAULTS = {
    "status": "idle",
    "week_start": "",
    "interview_thread_id": "",
    "interview_message_id": "",
    "draft_thread_id": "",
    "draft_message_id": "",
    "revision_count": 0,
    "last_feedback_message_id": "",
    "draft_files": [],
    "sent_post_dates": [],
    "last_weekend_nudge_date": "",
    "weekend_nudge_thread_id": "",
    "weekend_nudge_last_message_id": "",
    "storyboard_thread_id": "",
    "storyboard_message_id": "",
    "storyboard_file": "",
}


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_config():
    config = load_json(CONFIG_PATH, {})
    return {
        "timezone": config.get("timezone", "America/New_York"),
        "max_word_count_long": int(config.get("max_word_count_long", 450)),
        "max_word_count_short": int(config.get("max_word_count_short", 200)),
        "require_feedback_rounds": int(config.get("require_feedback_rounds", 1)),
        "max_additional_revisions": int(config.get("max_additional_revisions", 2)),
    }


def load_state():
    return load_json(STATE_PATH, STATE_DEFAULTS.copy())


def save_state(state):
    save_json(STATE_PATH, state)


def normalize_state(state):
    changed = False
    for key, value in STATE_DEFAULTS.items():
        if key not in state:
            state[key] = value
            changed = True
    return changed


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")[:60] or "post"


def next_monday(from_date: date) -> date:
    days_until = (0 - from_date.weekday() + 7) % 7
    if days_until == 0:
        days_until = 7
    return from_date + timedelta(days=days_until)


def week_dates(now: datetime):
    monday = next_monday(now.date())
    wednesday = monday + timedelta(days=2)
    friday = monday + timedelta(days=4)
    return monday, wednesday, friday


def read_file(path: Path):
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def parse_iso_date_from_filename(path):
    match = re.search(r"(20\d{2}-\d{2}-\d{2})_", path)
    return match.group(1) if match else ""


def load_approved_draft_files():
    text = read_file(APPROVAL_LOG_PATH)
    approved = set()
    for line in text.splitlines():
        if not re.search(r"\|\s*Approved\s*\|", line, re.IGNORECASE):
            continue
        match = re.search(r"`(drafts/[^`]+\.md)`", line.replace("\\", "/"))
        if match:
            approved.add(match.group(1))
    return approved


def find_draft_file_for_date(post_date: date, kind: str):
    pattern = f"{post_date.isoformat()}_{kind}_*.md"
    matches = sorted(DRAFTS_DIR.glob(pattern))
    if not matches:
        return None
    return matches[0]


def weekly_readiness(week_dates_tuple):
    approved = load_approved_draft_files()
    readiness = {"missing_drafts": [], "missing_approvals": [], "files": []}
    mapping = [
        ("post1", week_dates_tuple[0], "long"),
        ("post2", week_dates_tuple[1], "short"),
        ("post3", week_dates_tuple[2], "short"),
    ]
    for label, post_date, kind in mapping:
        path = find_draft_file_for_date(post_date, kind)
        if not path:
            readiness["missing_drafts"].append(f"{label} ({post_date.isoformat()}, {kind})")
            continue
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        readiness["files"].append(rel)
        if rel not in approved:
            readiness["missing_approvals"].append(rel)
    readiness["ready"] = not readiness["missing_drafts"] and not readiness["missing_approvals"]
    return readiness


def week_slots(week_dates_tuple):
    mapping = [
        ("post1", "Post 1 (Mon - Long)", week_dates_tuple[0], "long"),
        ("post2", "Post 2 (Wed - Short)", week_dates_tuple[1], "short"),
        ("post3", "Post 3 (Fri - Short)", week_dates_tuple[2], "short"),
    ]
    slots = []
    for key, label, post_date, kind in mapping:
        path = find_draft_file_for_date(post_date, kind)
        rel = str(path.relative_to(ROOT)).replace("\\", "/") if path else ""
        slots.append(
            {
                "key": key,
                "label": label,
                "date": post_date.isoformat(),
                "kind": kind,
                "path": rel,
            }
        )
    return slots


def build_weekend_nudge_body(week_start, week_dates_tuple):
    approved = load_approved_draft_files()
    slots = week_slots(week_dates_tuple)
    lines = [f"Next-week content approval packet for week of {week_start}.", ""]
    for slot in slots:
        if not slot["path"]:
            status = "Not drafted"
        elif slot["path"] in approved:
            status = "Approved"
        else:
            status = "Pending approval"
        lines.extend(
            [
                f"{slot['label']} ({slot['date']}) - {status}",
                f"File: {slot['path'] or '(not drafted yet)'}",
            ]
        )
        if slot["path"]:
            text = read_file(ROOT / slot["path"])
            title, body = parse_title_and_body(text)
            lines.extend([f"Title: {title}", body if body else "(empty draft body)"])
        else:
            lines.append("Content: Not drafted yet.")
        lines.extend(["", "---", ""])

    lines.extend(
        [
            "Reply options:",
            "- APPROVE ALL",
            "- APPROVE YYYY-MM-DD (example: APPROVE 2026-02-25)",
            "- REVISE POST 1|2|3: <notes> (or: edit the second post ...)",
            "- REVISE YYYY-MM-DD: <notes>",
            "",
            "If all three posts are approved, these approval emails stop for that week.",
        ]
    )
    return "\n".join(lines).strip()


def parse_title_and_body(markdown_text: str):
    if markdown_text.startswith("# "):
        lines = markdown_text.splitlines()
        title = lines[0].replace("# ", "").strip()
        body = "\n".join(lines[1:]).strip()
        return title, body
    return "LinkedIn Draft", markdown_text.strip()


def maybe_send_today_post(now: datetime, state):
    today_iso = now.date().isoformat()
    if today_iso in state["sent_post_dates"]:
        return False

    today_matches = sorted(DRAFTS_DIR.glob(f"{today_iso}_*.md"))
    if not today_matches:
        return False

    path = today_matches[0]
    rel = str(path.relative_to(ROOT)).replace("\\", "/")
    approved = load_approved_draft_files()
    if rel not in approved:
        return False

    text = read_file(path)
    title, body = parse_title_and_body(text)
    subject = f"Post Today - LinkedIn ({today_iso})"
    email_body = (
        f"Today's approved LinkedIn post is ready to publish.\n\n"
        f"File: {rel}\n"
        f"Title: {title}\n\n"
        f"{body}\n\n"
        f"Action: Copy/paste into LinkedIn and post manually."
    )
    send_email(subject, email_body)
    state["sent_post_dates"].append(today_iso)
    return True


def maybe_send_weekend_nudge(now: datetime, state, week_start, readiness):
    if now.weekday() not in (4, 5, 6):
        return False
    if readiness["ready"]:
        return False
    today_iso = now.date().isoformat()
    if state["last_weekend_nudge_date"] == today_iso:
        return False

    week_dates_tuple = (
        date.fromisoformat(week_start),
        date.fromisoformat(week_start) + timedelta(days=2),
        date.fromisoformat(week_start) + timedelta(days=4),
    )
    body = build_weekend_nudge_body(week_start, week_dates_tuple)
    msg_id, thread_id = send_email(
        f"Action Needed - Complete Next Week's LinkedIn Series ({week_start})",
        body,
    )
    state["last_weekend_nudge_date"] = today_iso
    state["weekend_nudge_thread_id"] = thread_id
    state["weekend_nudge_last_message_id"] = msg_id
    return True


def parse_approval_targets(reply_text, pending_paths):
    lowered = reply_text.lower()
    if "approve all" in lowered:
        return list(pending_paths)
    targets = set()
    for line in reply_text.splitlines():
        match = re.search(r"approve\s+(20\d{2}-\d{2}-\d{2})", line, re.IGNORECASE)
        if not match:
            continue
        wanted_date = match.group(1)
        for rel in pending_paths:
            if parse_iso_date_from_filename(rel) == wanted_date:
                targets.add(rel)
    if not targets and is_approval(reply_text) and not needs_revision(reply_text):
        return list(pending_paths)
    return sorted(targets)


def parse_revision_targets(reply_text, pending_paths, week_dates_tuple):
    if not pending_paths:
        return []
    lowered = reply_text.lower()
    targets = set()
    post_dates = {
        "post1": week_dates_tuple[0].isoformat(),
        "post2": week_dates_tuple[1].isoformat(),
        "post3": week_dates_tuple[2].isoformat(),
    }
    hints = {
        "post1": ["post 1", "post1", "first post", "first", "monday", post_dates["post1"]],
        "post2": ["post 2", "post2", "second post", "second", "wednesday", post_dates["post2"]],
        "post3": ["post 3", "post3", "third post", "third", "friday", post_dates["post3"]],
    }
    for key, words in hints.items():
        if any(word in lowered for word in words):
            wanted_date = post_dates[key]
            for rel in pending_paths:
                if parse_iso_date_from_filename(rel) == wanted_date:
                    targets.add(rel)
    if not targets:
        return list(pending_paths)
    return sorted(targets)


def draft_key_for_path(path: str, week_dates_tuple):
    normalized = path.replace("\\", "/")
    if "_long_" in normalized:
        return "post1"
    post_date = parse_iso_date_from_filename(normalized)
    if post_date == week_dates_tuple[1].isoformat():
        return "post2"
    if post_date == week_dates_tuple[2].isoformat():
        return "post3"
    if "post2" not in normalized:
        return "post2"
    return "post3"


def build_targeted_revision_prompt(
    truth_file,
    intake_answers,
    feedback,
    posts,
    target_keys,
    max_long,
    max_short,
):
    return (
        build_revision_prompt(
            truth_file,
            intake_answers,
            feedback,
            posts,
            max_long,
            max_short,
        )
        + "\n\nOnly revise these posts: "
        + ", ".join(sorted(target_keys))
        + ". Keep non-targeted posts unchanged."
    )


def append_approval_log(approved_paths, notes):
    if not approved_paths:
        return
    already_approved = load_approved_draft_files()
    approved_paths = [path for path in approved_paths if path not in already_approved]
    if not approved_paths:
        return
    if not APPROVAL_LOG_PATH.exists():
        APPROVAL_LOG_PATH.write_text(
            "# Approval Log\n\n| Date | Post | Status | Notes |\n|---|---|---|---|\n",
            encoding="utf-8",
        )
    rows = []
    today = datetime.utcnow().date().isoformat()
    for rel in approved_paths:
        rows.append(f"| {today} | `{rel}` | Approved | {notes} |")
    with APPROVAL_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write("\n" + "\n".join(rows) + "\n")


def parse_draft_version(subject: str):
    match = re.search(r"Draft v(\d+)", subject or "", re.IGNORECASE)
    if not match:
        return 0
    return max(0, int(match.group(1)))


def find_week_draft_files(week_start: str):
    monday = date.fromisoformat(week_start)
    wednesday = monday + timedelta(days=2)
    friday = monday + timedelta(days=4)
    files = []
    for post_date in (monday, wednesday, friday):
        matches = sorted(DRAFTS_DIR.glob(f"{post_date.isoformat()}_*.md"))
        if matches:
            files.append(str(matches[0].relative_to(ROOT)).replace("\\", "/"))
    return files


def maybe_process_weekend_approval_reply(state, readiness, week_start, config):
    if not state.get("weekend_nudge_thread_id"):
        return False
    after_message_id = state.get("weekend_nudge_last_message_id", "")
    if not after_message_id:
        after_message_id = latest_message_id_in_thread(
            state["weekend_nudge_thread_id"], expected_sender=os.getenv("GMAIL_USER", "")
        )
    msg_id, reply_text = latest_reply_in_thread(
        state["weekend_nudge_thread_id"],
        expected_sender=os.getenv("EMAIL_TO", ""),
        after_message_id=after_message_id,
    )
    if not reply_text:
        return False
    target_monday = date.fromisoformat(week_start)
    week_dates_tuple = (
        target_monday,
        target_monday + timedelta(days=2),
        target_monday + timedelta(days=4),
    )
    pending = readiness.get("missing_approvals", [])
    if needs_revision(reply_text):
        if len(readiness.get("files", [])) < 3:
            state["weekend_nudge_last_message_id"] = msg_id
            return False
        revision_targets = parse_revision_targets(reply_text, pending, week_dates_tuple)
        target_keys = {draft_key_for_path(path, week_dates_tuple) for path in revision_targets}
        if not target_keys:
            state["weekend_nudge_last_message_id"] = msg_id
            return False
        posts = load_posts_from_files(readiness["files"])
        truth_file = read_file(TRUTH_FILE_PATH)
        intake_answers = read_file(INTAKE_ANSWERS_PATH)
        prompt = build_targeted_revision_prompt(
            truth_file,
            intake_answers,
            reply_text,
            posts,
            target_keys,
            config["max_word_count_long"],
            config["max_word_count_short"],
        )
        raw = chat_complete("You are a helpful writing assistant.", prompt)
        revised = parse_json_block(raw)
        for key in ("post1", "post2", "post3"):
            if key not in target_keys:
                revised[key] = posts[key]
        ensure_word_limits(revised, config["max_word_count_long"], config["max_word_count_short"])
        save_drafts(revised, week_dates_tuple)
        body = build_weekend_nudge_body(week_start, week_dates_tuple)
        sent_id, _ = send_email(
            f"Action Needed - Complete Next Week's LinkedIn Series ({week_start})",
            body,
            thread_id=state["weekend_nudge_thread_id"],
        )
        state["weekend_nudge_last_message_id"] = sent_id
        return True

    approved_now = parse_approval_targets(reply_text, pending)
    if approved_now:
        append_approval_log(approved_now, "Approved by email command.")
        body = "Approved entries logged:\n" + "\n".join([f"- {p}" for p in approved_now])
        sent_id, _ = send_email("Approval Logged", body, thread_id=state["weekend_nudge_thread_id"])
        state["weekend_nudge_last_message_id"] = sent_id
        return True
    state["weekend_nudge_last_message_id"] = msg_id
    return False


def maybe_recover_pipeline_state(state, week_start, config):
    current_status = state.get("status", "idle")
    if current_status not in ("idle", "complete"):
        return False

    week_marker = f"(Week of {week_start})"
    gmail_user = os.getenv("GMAIL_USER", "")

    draft_latest = find_latest_message_for_subject("Draft v")
    if draft_latest and week_marker in draft_latest.get("subject", ""):
        thread_id = draft_latest.get("thread_id", "")
        if thread_id:
            sent_id = latest_message_id_in_thread(thread_id, expected_sender=gmail_user)
            version = parse_draft_version(draft_latest.get("subject", ""))
            revision_count = max(0, version - 1)
            recovered_status = (
                "final_sent"
                if revision_count >= config["require_feedback_rounds"]
                else "waiting_for_feedback"
            )
            state.update(
                {
                    "status": recovered_status,
                    "week_start": week_start,
                    "draft_thread_id": thread_id,
                    "draft_message_id": sent_id or draft_latest.get("message_id", ""),
                    "last_feedback_message_id": sent_id or draft_latest.get("message_id", ""),
                    "draft_files": find_week_draft_files(week_start),
                    "revision_count": revision_count,
                }
            )
            return True

    storyboard_latest = find_latest_message_for_subject("Storyboard Draft")
    if storyboard_latest and week_marker in storyboard_latest.get("subject", ""):
        thread_id = storyboard_latest.get("thread_id", "")
        if thread_id:
            sent_id = latest_message_id_in_thread(thread_id, expected_sender=gmail_user)
            state.update(
                {
                    "status": "waiting_for_storyboard_approval",
                    "week_start": week_start,
                    "storyboard_thread_id": thread_id,
                    "storyboard_message_id": sent_id or storyboard_latest.get("message_id", ""),
                    "storyboard_file": f"drafts/{week_start}_storyboard.md",
                }
            )
            return True

    interview_subject = f"Friday Interview - LinkedIn Series (Week of {week_start})"
    interview_latest = find_latest_message_for_subject(interview_subject)
    if interview_latest:
        thread_id = interview_latest.get("thread_id", "")
        if thread_id:
            sent_id = latest_message_id_in_thread(thread_id, expected_sender=gmail_user)
            state.update(
                {
                    "status": "waiting_for_interview",
                    "week_start": week_start,
                    "interview_thread_id": thread_id,
                    "interview_message_id": sent_id or interview_latest.get("message_id", ""),
                }
            )
            return True
    return False


def write_intake_answers(answers: str, week_start: date):
    content = (
        f"# Weekly Interview Answers\n\n"
        f"Week of: {week_start.isoformat()}\n\n"
        f"{answers.strip()}\n"
    )
    INTAKE_ANSWERS_PATH.write_text(content, encoding="utf-8")


def parse_json_block(text):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model output.")
    return json.loads(match.group(0))


def build_generation_prompt(truth_file, intake_answers, week_start, max_long, max_short):
    return f"""You are Iris, a LinkedIn PR agency. Use only the facts in the truth file.
Do not include confidential details, partner names, or unapproved metrics.

Truth file:
{truth_file}

Interview answers:
{intake_answers}

Create a three-part series for the week of {week_start}.
Post 1 is long form (<= {max_long} words).
Posts 2 and 3 are short (<= {max_short} words).
Each post must end with one open question and one warm, human closing line.

Return ONLY valid JSON with this schema:
{{
  "post1": {{"title": "...", "body": "..."}},
  "post2": {{"title": "...", "body": "..."}},
  "post3": {{"title": "...", "body": "..."}}
}}"""


def build_storyboard_prompt(truth_file, intake_answers, week_start):
    return f"""You are Iris, a LinkedIn PR agency. Build a weekly storyboard for LinkedIn.
Use only the truth file and intake answers.

Truth file:
{truth_file}

Interview answers:
{intake_answers}

Week of: {week_start}

Return ONLY valid JSON:
{{
  "theme": "...",
  "audience": "...",
  "post1_angle": "...",
  "post2_angle": "...",
  "post3_angle": "...",
  "proof_points": ["...", "..."],
  "risks_to_avoid": ["...", "..."],
  "cta_intent": "..."
}}"""


def build_storyboard_revision_prompt(storyboard, feedback):
    return f"""Revise this weekly storyboard based on feedback.
Return ONLY valid JSON with same schema.

Current storyboard:
{json.dumps(storyboard, indent=2)}

Feedback:
{feedback}
"""


def save_storyboard(week_start, storyboard):
    path = DRAFTS_DIR / f"{week_start}_storyboard.md"
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    content = [
        f"# Storyboard - Week of {week_start}",
        "",
        f"Theme: {storyboard.get('theme', '')}",
        f"Audience: {storyboard.get('audience', '')}",
        "",
        f"Post 1 angle: {storyboard.get('post1_angle', '')}",
        f"Post 2 angle: {storyboard.get('post2_angle', '')}",
        f"Post 3 angle: {storyboard.get('post3_angle', '')}",
        "",
        "Proof points:",
    ]
    content.extend([f"- {p}" for p in storyboard.get("proof_points", [])])
    content.append("")
    content.append("Risks to avoid:")
    content.extend([f"- {r}" for r in storyboard.get("risks_to_avoid", [])])
    content.append("")
    content.append(f"CTA intent: {storyboard.get('cta_intent', '')}")
    path.write_text("\n".join(content).strip() + "\n", encoding="utf-8")
    return str(path.relative_to(ROOT)).replace("\\", "/")


def build_storyboard_email_body(week_start, storyboard_path, storyboard):
    return "\n".join(
        [
            f"Weekly Storyboard Draft",
            f"Week of: {week_start}",
            f"File: {storyboard_path}",
            "",
            json.dumps(storyboard, indent=2),
            "",
            "Reply with one of:",
            "- APPROVE STORYBOARD",
            "- REVISE STORYBOARD: <notes>",
        ]
    ).strip()


def build_generation_prompt_with_storyboard(
    truth_file, intake_answers, storyboard_text, week_start, max_long, max_short
):
    return f"""You are Iris, a LinkedIn PR agency. Use only approved inputs.
Do not include confidential details, partner names, or unapproved metrics.

Truth file:
{truth_file}

Interview answers:
{intake_answers}

Approved storyboard:
{storyboard_text}

Create a three-part series for week of {week_start}.
Post 1 long <= {max_long} words.
Post 2 and 3 short <= {max_short} words.
Each post must end with one open question and one warm, human closing line.

Return ONLY valid JSON:
{{
  "post1": {{"title": "...", "body": "..."}},
  "post2": {{"title": "...", "body": "..."}},
  "post3": {{"title": "...", "body": "..."}}
}}"""


def build_revision_prompt(truth_file, intake_answers, feedback, posts, max_long, max_short):
    return f"""You are Iris, a LinkedIn PR agency. Use only the facts in the truth file.
Revise the three posts based on the feedback.
Keep the same structure and word limits.

Truth file:
{truth_file}

Interview answers:
{intake_answers}

Feedback:
{feedback}

Current posts:
{json.dumps(posts, indent=2)}

Word limits: post1 <= {max_long} words, post2/post3 <= {max_short} words.
Each post must end with one open question and one warm, human closing line.

Return ONLY valid JSON with this schema:
{{
  "post1": {{"title": "...", "body": "..."}},
  "post2": {{"title": "...", "body": "..."}},
  "post3": {{"title": "...", "body": "..."}}
}}"""


def word_count(text):
    return len(re.findall(r"\b\w+\b", text))


def ensure_word_limits(posts, max_long, max_short):
    limits = {"post1": max_long, "post2": max_short, "post3": max_short}
    for key, limit in limits.items():
        body = posts[key]["body"]
        if word_count(body) > limit:
            raise ValueError(f"{key} exceeds word limit ({limit}).")


def save_drafts(posts, week_dates_tuple):
    monday, wednesday, friday = week_dates_tuple
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    mapping = [
        ("post1", monday, "long"),
        ("post2", wednesday, "short"),
        ("post3", friday, "short"),
    ]
    for key, post_date, kind in mapping:
        title = posts[key]["title"].strip()
        body = posts[key]["body"].strip()
        filename = f"{post_date.isoformat()}_{kind}_{slugify(title)}.md"
        path = DRAFTS_DIR / filename
        content = f"# {title}\n\n{body}\n"
        path.write_text(content, encoding="utf-8")
        files.append(str(path.relative_to(ROOT)))
    return files


def build_draft_email_body(week_start, posts, files, version_label):
    lines = [
        f"LinkedIn Series Drafts ({version_label})",
        f"Week of: {week_start}",
        "",
        "Files:",
        *[f"- {file}" for file in files],
        "",
        "Post 1 (Mon - Long):",
        posts["post1"]["body"],
        "",
        "Post 2 (Wed - Short):",
        posts["post2"]["body"],
        "",
        "Post 3 (Fri - Short):",
        posts["post3"]["body"],
        "",
        "Reply with feedback. Include 'revise' for additional changes.",
    ]
    return "\n".join(lines).strip()


def needs_revision(text):
    lowered = text.lower()
    keywords = ["revise", "change", "update", "fix", "adjust", "edit", "tweak"]
    return any(k in lowered for k in keywords)


def is_approval(text):
    lowered = text.lower()
    return any(k in lowered for k in ["approve", "looks good", "final", "ship it", "ok"])


def main():
    config = load_config()
    tz = ZoneInfo(config["timezone"])
    now = datetime.now(tz)
    monday, wednesday, friday = week_dates(now)
    week_start = monday.isoformat()

    state = load_state()
    state_changed = normalize_state(state)
    if state_changed:
        save_state(state)

    if maybe_send_today_post(now, state):
        save_state(state)

    if maybe_recover_pipeline_state(state, week_start, config):
        save_state(state)

    readiness = weekly_readiness((monday, wednesday, friday))
    weekend_subject = f"Action Needed - Complete Next Week's LinkedIn Series ({week_start})"
    if not state.get("weekend_nudge_thread_id"):
        latest = find_latest_message_for_subject(weekend_subject)
        if latest:
            state["weekend_nudge_thread_id"] = latest["thread_id"]
            state["weekend_nudge_last_message_id"] = latest_message_id_in_thread(
                latest["thread_id"], expected_sender=os.getenv("GMAIL_USER", "")
            )
            message_day = datetime.fromtimestamp(
                latest["internal_date"] / 1000, tz=now.tzinfo
            ).date()
            if message_day == now.date():
                state["last_weekend_nudge_date"] = now.date().isoformat()
            save_state(state)

    if maybe_send_weekend_nudge(now, state, week_start, readiness):
        save_state(state)
        return
    if maybe_process_weekend_approval_reply(state, readiness, week_start, config):
        save_state(state)
        return

    # Step 1: Send interview on Friday if idle and next week still needs drafts.
    if now.weekday() == 4 and state["status"] in ["idle", "complete"]:
        if not readiness["missing_drafts"]:
            return
        questions = read_file(INTAKE_QUESTIONS_PATH)
        subject = f"Friday Interview - LinkedIn Series (Week of {week_start})"
        body = (
            "Quick interview to create next week's three-part LinkedIn series.\n"
            f"Week of: {week_start}\n\n"
            "Please reply in plain text. Keep answers concise and specific.\n\n"
            f"{questions}\n"
        )
        msg_id, thread_id = send_email(subject, body)
        state.update(
            {
                "status": "waiting_for_interview",
                "week_start": week_start,
                "interview_thread_id": thread_id,
                "interview_message_id": msg_id,
                "draft_thread_id": "",
                "draft_message_id": "",
                "revision_count": 0,
                "last_feedback_message_id": "",
                "draft_files": [],
                "storyboard_thread_id": "",
                "storyboard_message_id": "",
                "storyboard_file": "",
            }
        )
        save_state(state)
        return

    # Step 2: Check for interview reply
    if state["status"] == "waiting_for_interview" and state["interview_thread_id"]:
        target_week_start = state["week_start"] or week_start
        target_monday = date.fromisoformat(target_week_start)
        target_wednesday = target_monday + timedelta(days=2)
        target_friday = target_monday + timedelta(days=4)
        msg_id, reply_text = latest_reply_in_thread(
            state["interview_thread_id"],
            expected_sender=os.getenv("EMAIL_TO", ""),
            after_message_id=state["interview_message_id"],
        )
        if reply_text:
            write_intake_answers(reply_text, target_monday)
            truth_file = read_file(TRUTH_FILE_PATH)
            intake_answers = read_file(INTAKE_ANSWERS_PATH)
            prompt = build_storyboard_prompt(truth_file, intake_answers, target_week_start)
            raw = chat_complete("You are a helpful writing assistant.", prompt)
            storyboard = parse_json_block(raw)
            storyboard_file = save_storyboard(target_week_start, storyboard)
            body = build_storyboard_email_body(target_week_start, storyboard_file, storyboard)
            subject = f"Storyboard Draft - LinkedIn Series (Week of {target_week_start})"
            storyboard_msg_id, storyboard_thread_id = send_email(subject, body)
            state.update(
                {
                    "status": "waiting_for_storyboard_approval",
                    "storyboard_thread_id": storyboard_thread_id,
                    "storyboard_message_id": storyboard_msg_id,
                    "storyboard_file": storyboard_file,
                }
            )
            save_state(state)
        return

    if state["status"] == "waiting_for_storyboard_approval" and state["storyboard_thread_id"]:
        target_week_start = state["week_start"] or week_start
        target_monday = date.fromisoformat(target_week_start)
        target_wednesday = target_monday + timedelta(days=2)
        target_friday = target_monday + timedelta(days=4)
        msg_id, reply_text = latest_reply_in_thread(
            state["storyboard_thread_id"],
            expected_sender=os.getenv("EMAIL_TO", ""),
            after_message_id=state["storyboard_message_id"],
        )
        if not reply_text:
            return
        storyboard_text = read_file(ROOT / state["storyboard_file"])
        truth_file = read_file(TRUTH_FILE_PATH)
        intake_answers = read_file(INTAKE_ANSWERS_PATH)
        if needs_revision(reply_text):
            current = {"storyboard_markdown": storyboard_text}
            raw = chat_complete(
                "You are a helpful writing assistant.",
                build_storyboard_revision_prompt(current, reply_text),
            )
            revised = parse_json_block(raw)
            storyboard_file = save_storyboard(target_week_start, revised)
            body = build_storyboard_email_body(target_week_start, storyboard_file, revised)
            subject = f"Storyboard Draft v2 - LinkedIn Series (Week of {target_week_start})"
            sent_id, thread_id = send_email(subject, body, thread_id=state["storyboard_thread_id"])
            state.update(
                {
                    "storyboard_thread_id": thread_id,
                    "storyboard_message_id": sent_id,
                    "storyboard_file": storyboard_file,
                }
            )
            save_state(state)
            return
        if is_approval(reply_text):
            prompt = build_generation_prompt_with_storyboard(
                truth_file,
                intake_answers,
                storyboard_text,
                target_week_start,
                config["max_word_count_long"],
                config["max_word_count_short"],
            )
            raw = chat_complete("You are a helpful writing assistant.", prompt)
            posts = parse_json_block(raw)
            ensure_word_limits(posts, config["max_word_count_long"], config["max_word_count_short"])
            files = save_drafts(posts, (target_monday, target_wednesday, target_friday))
            body = build_draft_email_body(target_week_start, posts, files, "v1")
            subject = f"Draft v1 - LinkedIn Series (Week of {target_week_start})"
            draft_msg_id, draft_thread_id = send_email(subject, body)
            state.update(
                {
                    "status": "waiting_for_feedback",
                    "draft_thread_id": draft_thread_id,
                    "draft_message_id": draft_msg_id,
                    "revision_count": 0,
                    "last_feedback_message_id": draft_msg_id,
                    "draft_files": files,
                }
            )
            save_state(state)
        return

    # Step 3: Feedback loop
    if state["status"] == "waiting_for_feedback" and state["draft_thread_id"]:
        target_week_start = state["week_start"] or week_start
        target_monday = date.fromisoformat(target_week_start)
        target_wednesday = target_monday + timedelta(days=2)
        target_friday = target_monday + timedelta(days=4)
        msg_id, reply_text = latest_reply_in_thread(
            state["draft_thread_id"],
            expected_sender=os.getenv("EMAIL_TO", ""),
            after_message_id=state["last_feedback_message_id"],
        )
        if not reply_text:
            return

        truth_file = read_file(TRUTH_FILE_PATH)
        intake_answers = read_file(INTAKE_ANSWERS_PATH)

        # Always do the first revision round.
        if state["revision_count"] < config["require_feedback_rounds"]:
            posts = load_posts_from_files(state["draft_files"])
            prompt = build_revision_prompt(
                truth_file,
                intake_answers,
                reply_text,
                posts,
                config["max_word_count_long"],
                config["max_word_count_short"],
            )
            raw = chat_complete("You are a helpful writing assistant.", prompt)
            revised = parse_json_block(raw)
            ensure_word_limits(revised, config["max_word_count_long"], config["max_word_count_short"])
            files = save_drafts(revised, (target_monday, target_wednesday, target_friday))
            body = build_draft_email_body(target_week_start, revised, files, "v2")
            subject = f"Draft v2 - LinkedIn Series (Week of {target_week_start})"
            msg_sent, thread_id = send_email(subject, body, thread_id=state["draft_thread_id"])
            state.update(
                {
                    "revision_count": state["revision_count"] + 1,
                    "last_feedback_message_id": msg_id,
                    "draft_files": files,
                    "draft_message_id": msg_sent,
                    "draft_thread_id": thread_id,
                    "status": "final_sent",
                }
            )
            save_state(state)
            return

    if state["status"] == "final_sent" and state["draft_thread_id"]:
        target_week_start = state["week_start"] or week_start
        target_monday = date.fromisoformat(target_week_start)
        target_wednesday = target_monday + timedelta(days=2)
        target_friday = target_monday + timedelta(days=4)
        msg_id, reply_text = latest_reply_in_thread(
            state["draft_thread_id"],
            expected_sender=os.getenv("EMAIL_TO", ""),
            after_message_id=state["last_feedback_message_id"],
        )
        if not reply_text:
            return

        if needs_revision(reply_text) and state["revision_count"] < (
            config["require_feedback_rounds"] + config["max_additional_revisions"]
        ):
            truth_file = read_file(TRUTH_FILE_PATH)
            intake_answers = read_file(INTAKE_ANSWERS_PATH)
            posts = load_posts_from_files(state["draft_files"])
            prompt = build_revision_prompt(
                truth_file,
                intake_answers,
                reply_text,
                posts,
                config["max_word_count_long"],
                config["max_word_count_short"],
            )
            raw = chat_complete("You are a helpful writing assistant.", prompt)
            revised = parse_json_block(raw)
            ensure_word_limits(revised, config["max_word_count_long"], config["max_word_count_short"])
            files = save_drafts(revised, (target_monday, target_wednesday, target_friday))
            body = build_draft_email_body(
                target_week_start, revised, files, f"v{state['revision_count'] + 1}"
            )
            subject = (
                f"Draft v{state['revision_count'] + 1} - "
                f"LinkedIn Series (Week of {target_week_start})"
            )
            msg_sent, thread_id = send_email(subject, body, thread_id=state["draft_thread_id"])
            state.update(
                {
                    "revision_count": state["revision_count"] + 1,
                    "last_feedback_message_id": msg_id,
                    "draft_files": files,
                    "draft_message_id": msg_sent,
                    "draft_thread_id": thread_id,
                }
            )
            save_state(state)
            return

        if is_approval(reply_text):
            state.update(
                {
                    "status": "complete",
                    "last_feedback_message_id": msg_id,
                }
            )
            save_state(state)


def load_posts_from_files(files):
    posts = {}
    for file_path in files:
        path = ROOT / file_path
        text = read_file(path)
        if text.startswith("# "):
            lines = text.splitlines()
            title = lines[0].replace("# ", "").strip()
            body = "\n".join(lines[1:]).strip()
        else:
            title = "Draft"
            body = text
        if "_long_" in file_path:
            posts["post1"] = {"title": title, "body": body}
        elif "post2" not in posts:
            posts["post2"] = {"title": title, "body": body}
        else:
            posts["post3"] = {"title": title, "body": body}
    return posts


if __name__ == "__main__":
    main()
