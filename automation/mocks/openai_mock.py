import json


DEFAULT_STORYBOARD = {
    "theme": "Practical automation lessons",
    "audience": "Builders shipping internal tools",
    "post1_angle": "What changed in the workflow this week",
    "post2_angle": "A specific bottleneck we fixed",
    "post3_angle": "A reflection and question for peers",
    "proof_points": ["Reduced manual checks", "Clearer approvals"],
    "risks_to_avoid": ["No partner names", "No unapproved metrics"],
    "cta_intent": "Invite peers to share similar lessons",
}

DEFAULT_POSTS_V1 = {
    "post1": {
        "title": "A quieter workflow",
        "body": (
            "We tightened the weekly loop so feedback never gets lost. "
            "The most valuable change was a clearer handoff from interview to storyboard. "
            "It made every next step easier.\n\n"
            "What part of your process feels noisy right now? "
            "Thanks for reading."
        ),
    },
    "post2": {
        "title": "One bottleneck fixed",
        "body": (
            "A single approval step used to stall everything. "
            "We made approvals explicit and the work started flowing again.\n\n"
            "Where does your work slow down the most? "
            "Thanks for reading."
        ),
    },
    "post3": {
        "title": "The weekly question",
        "body": (
            "I am learning that consistency beats intensity. "
            "The small, repeatable loop is the real win.\n\n"
            "What small loop are you improving this month? "
            "Thanks for reading."
        ),
    },
}

DEFAULT_POSTS_REVISION = {
    "post1": DEFAULT_POSTS_V1["post1"],
    "post2": {
        "title": "One bottleneck fixed",
        "body": (
            "A single approval step used to stall everything. "
            "We added a simple reply command and the loop stopped blocking.\n\n"
            "Where does your work slow down the most? "
            "Thanks for reading."
        ),
    },
    "post3": DEFAULT_POSTS_V1["post3"],
}


class MockOpenAI:
    def __init__(self, fixtures=None):
        self.fixtures = fixtures or {}

    def _pick(self, key, fallback):
        if key in self.fixtures:
            return self.fixtures[key]
        return fallback

    def chat_complete(self, system_prompt, user_prompt, temperature=0.4):
        prompt = (user_prompt or "").lower()
        if "weekly storyboard" in prompt and "revise this weekly storyboard" not in prompt:
            payload = self._pick("storyboard", DEFAULT_STORYBOARD)
            return json.dumps(payload)
        if "revise this weekly storyboard" in prompt:
            payload = self._pick("storyboard_revision", DEFAULT_STORYBOARD)
            return json.dumps(payload)
        if "create a three-part series" in prompt:
            payload = self._pick("posts_v1", DEFAULT_POSTS_V1)
            return json.dumps(payload)
        if "revise the three posts" in prompt:
            payload = self._pick("posts_revision", DEFAULT_POSTS_REVISION)
            return json.dumps(payload)
        payload = self._pick("default", DEFAULT_POSTS_V1)
        return json.dumps(payload)

