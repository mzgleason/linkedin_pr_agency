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

DEFAULT_TOPIC_PITCHES = {
    "topics": [
        {
            "topic": "Consistency beats intensity in content ops",
            "why_it_matters": "Most creators quit because the system is fragile, not because they lack ideas.",
            "opinion_pitch": "If your content engine requires motivation, it's already broken. The best LinkedIn output comes from boring, repeatable loops that survive bad weeks. Build the system first; creativity follows.",
            "angle_type": "framework",
            "strength_score": 8.5,
        },
        {
            "topic": "Stop chasing virality; chase clarity",
            "why_it_matters": "Teams optimize for reach and end up publishing vague, forgettable posts.",
            "opinion_pitch": "Virality is a lagging indicator, not a strategy. If you can’t summarize your point of view in one crisp sentence, no hook will save it. Clarity creates compounding trust; hype creates churn.",
            "angle_type": "contrarian",
            "strength_score": 8.0,
        },
        {
            "topic": "The real bottleneck is approvals, not writing",
            "why_it_matters": "Drafts pile up when decision rights are unclear.",
            "opinion_pitch": "Most content pipelines fail at governance, not creativity. If approvals live in a vague 'feedback' bucket, every post becomes a debate. Define what 'approved' means and the writing speeds up overnight.",
            "angle_type": "teardown",
            "strength_score": 7.7,
        },
        {
            "topic": "Feedback rounds should be mandatory, but capped",
            "why_it_matters": "Unbounded revision cycles drain momentum and quality.",
            "opinion_pitch": "A single required feedback round forces real thinking and prevents shipping the first draft. But a second optional round is where good posts go to die. Cap it: one serious revision, then publish.",
            "angle_type": "myth_bust",
            "strength_score": 7.2,
        },
        {
            "topic": "Your 'tone' is a system output",
            "why_it_matters": "People blame voice when the inputs are inconsistent.",
            "opinion_pitch": "Tone isn’t a personality trait; it’s what happens when your constraints are stable. If your truth file and weekly intake are sharp, your voice will be sharp. Fix inputs before you rewrite style guides.",
            "angle_type": "war_story",
            "strength_score": 6.9,
        },
    ]
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
        if "topic pitches" in prompt or "topic discovery" in prompt:
            payload = self._pick("topic_pitches", DEFAULT_TOPIC_PITCHES)
            return json.dumps(payload)
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

