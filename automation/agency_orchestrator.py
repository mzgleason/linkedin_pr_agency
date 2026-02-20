import json
import os
import re
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

from gmail_client import send_email, latest_reply_in_thread
from openai_client import chat_complete


ROOT = Path(__file__).resolve().parents[1]
AUTOMATION_DIR = Path(__file__).resolve().parent
CONFIG_PATH = AUTOMATION_DIR / "config.json"
STATE_PATH = AUTOMATION_DIR / "state.json"
INTAKE_QUESTIONS_PATH = ROOT / "intake.md"
INTAKE_ANSWERS_PATH = ROOT / "intake_answers.md"
TRUTH_FILE_PATH = ROOT / "truth_file.md"
DRAFTS_DIR = ROOT / "drafts"


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
    default = {
        "status": "idle",
        "week_start": "",
        "interview_thread_id": "",
        "interview_message_id": "",
        "draft_thread_id": "",
        "draft_message_id": "",
        "revision_count": 0,
        "last_feedback_message_id": "",
        "draft_files": [],
    }
    return load_json(STATE_PATH, default)


def save_state(state):
    save_json(STATE_PATH, state)


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

    # Step 1: Send interview on Friday if idle
    if now.weekday() == 4 and state["status"] in ["idle", "complete"]:
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
            }
        )
        save_state(state)
        return

    # Step 2: Check for interview reply
    if state["status"] == "waiting_for_interview" and state["interview_thread_id"]:
        msg_id, reply_text = latest_reply_in_thread(
            state["interview_thread_id"],
            expected_sender=os.getenv("EMAIL_TO", ""),
            after_message_id=state["interview_message_id"],
        )
        if reply_text:
            write_intake_answers(reply_text, monday)
            truth_file = read_file(TRUTH_FILE_PATH)
            intake_answers = read_file(INTAKE_ANSWERS_PATH)
            prompt = build_generation_prompt(
                truth_file, intake_answers, week_start,
                config["max_word_count_long"], config["max_word_count_short"]
            )
            raw = chat_complete("You are a helpful writing assistant.", prompt)
            posts = parse_json_block(raw)
            ensure_word_limits(posts, config["max_word_count_long"], config["max_word_count_short"])
            files = save_drafts(posts, (monday, wednesday, friday))
            body = build_draft_email_body(week_start, posts, files, "v1")
            subject = f"Draft v1 - LinkedIn Series (Week of {week_start})"
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
            files = save_drafts(revised, (monday, wednesday, friday))
            body = build_draft_email_body(week_start, revised, files, "v2")
            subject = f"Draft v2 - LinkedIn Series (Week of {week_start})"
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
            files = save_drafts(revised, (monday, wednesday, friday))
            body = build_draft_email_body(week_start, revised, files, f"v{state['revision_count'] + 1}")
            subject = f"Draft v{state['revision_count'] + 1} - LinkedIn Series (Week of {week_start})"
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
