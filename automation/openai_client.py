import json
import os
from pathlib import Path

import requests


OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


def load_config_model():
    if not CONFIG_PATH.exists():
        return ""
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return data.get("openai_model", "").strip()


def load_openai():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "").strip() or load_config_model()
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY in .env")
    if not model:
        raise RuntimeError("Missing OPENAI_MODEL in .env")
    return api_key, model


def chat_complete(system_prompt, user_prompt, temperature=0.4):
    api_key, model = load_openai()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if temperature is not None:
        payload["temperature"] = temperature
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(OPENAI_API_URL, json=payload, headers=headers, timeout=60)
    if resp.status_code >= 400:
        if resp.status_code == 400 and "temperature" in resp.text and "unsupported" in resp.text:
            payload.pop("temperature", None)
            resp = requests.post(OPENAI_API_URL, json=payload, headers=headers, timeout=60)
        if resp.status_code >= 400:
            raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text}")
    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenAI response missing choices.")
    return choices[0].get("message", {}).get("content", "").strip()
