import itertools
import time


class MockGmail:
    def __init__(self, fixtures=None):
        self.fixtures = fixtures or {}
        self._id = itertools.count(1)
        self.threads = {}
        self.thread_subjects = {}
        self.reply_queues = {}

    def _next_id(self):
        return f"msg-{next(self._id)}"

    def _new_thread_id(self):
        return f"thread-{next(self._id)}"

    def _queue_replies_for_subject(self, subject):
        replies = []
        if "Friday Interview" in subject:
            reply = self.fixtures.get("interview_reply", "")
            if reply:
                replies.append(reply)
        if "Storyboard Draft" in subject:
            reply = self.fixtures.get("storyboard_reply", "")
            if reply:
                replies.append(reply)
        if "Draft v1" in subject:
            first = self.fixtures.get("draft_reply", "")
            second = self.fixtures.get("final_approval_reply", "")
            if first:
                replies.append(first)
            if second:
                replies.append(second)
        if "Action Needed" in subject:
            reply = self.fixtures.get("weekend_reply", "")
            if reply:
                replies.append(reply)
        return replies

    def send_email(self, subject, body, thread_id=None):
        msg_id = self._next_id()
        if thread_id:
            tid = thread_id
        else:
            tid = self._new_thread_id()
            self.thread_subjects[tid] = subject
            self.reply_queues[tid] = self._queue_replies_for_subject(subject)
        messages = self.threads.setdefault(tid, [])
        messages.append(
            {
                "id": msg_id,
                "subject": subject,
                "body": body,
                "sender": "agency@example.com",
                "internal_date": int(time.time() * 1000),
            }
        )
        return msg_id, tid

    def latest_reply_in_thread(self, thread_id, expected_sender=None, after_message_id=None):
        queue = self.reply_queues.get(thread_id, [])
        if not queue:
            return None, ""
        reply_text = queue.pop(0)
        msg_id = self._next_id()
        self.threads.setdefault(thread_id, []).append(
            {
                "id": msg_id,
                "subject": self.thread_subjects.get(thread_id, ""),
                "body": reply_text,
                "sender": "owner@example.com",
                "internal_date": int(time.time() * 1000),
            }
        )
        return msg_id, reply_text

    def latest_message_id_in_thread(self, thread_id, expected_sender=None):
        messages = self.threads.get(thread_id, [])
        if not messages:
            return ""
        if expected_sender:
            expected = expected_sender.lower().strip()
            for msg in reversed(messages):
                if msg.get("sender", "").lower().strip() == expected:
                    return msg.get("id", "")
            return ""
        return messages[-1].get("id", "")

    def find_latest_message_for_subject(self, subject, max_results=10):
        best = None
        for thread_id, messages in self.threads.items():
            for msg in messages:
                if subject not in msg.get("subject", ""):
                    continue
                candidate = {
                    "message_id": msg.get("id", ""),
                    "thread_id": thread_id,
                    "internal_date": msg.get("internal_date", 0),
                    "sender": msg.get("sender", ""),
                    "subject": msg.get("subject", ""),
                }
                if not best or candidate["internal_date"] > best["internal_date"]:
                    best = candidate
        return best

