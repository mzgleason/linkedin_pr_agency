from __future__ import annotations

import os
from pathlib import Path

from google import genai
from google.genai import types


MODEL = "gemini-3-pro-image-preview"
HEADSHOT = Path(r"C:\Users\markz\OneDrive\Pictures\MarkGleason.png")
OUTPUT = Path(r"C:\Users\markz\linkedin_pr_agency\visuals\week1_image.png")
PROMPT = (
    "Create a clean, professional 16:9 LinkedIn image. "
    "Use the provided headshot of a male PM as the left-side portrait (about 40% width), "
    "sharply in focus with a soft neutral background. "
    'On the right side, place a minimalist workflow diagram titled "Agentic Posting Workflow" '
    "with five rounded boxes connected left-to-right: Intake -> Drafts -> QA -> Approval -> Publish. "
    "Use subtle gray lines, navy text, and a single teal accent. "
    "Keep whitespace generous, typography modern and clean, no icons. "
    "Overall look: editorial, credible, high-agency, not flashy."
)


def main() -> None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing GEMINI_API_KEY in environment.")

    if not HEADSHOT.exists():
        raise SystemExit(f"Headshot not found: {HEADSHOT}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=api_key)
    image_bytes = HEADSHOT.read_bytes()

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
        ],
        config={
            "response_modalities": ["IMAGE"],
            "image_config": {"aspect_ratio": "16:9"},
        },
    )

    for candidate in response.candidates or []:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        for part in content.parts or []:
            inline_data = getattr(part, "inline_data", None)
            data = getattr(inline_data, "data", None)
            if data:
                OUTPUT.write_bytes(data)
                print(str(OUTPUT))
                return

    raise SystemExit("No image returned by model.")


if __name__ == "__main__":
    main()
