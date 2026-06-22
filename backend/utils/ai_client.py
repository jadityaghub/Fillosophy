"""
utils/ai_client.py — Fillosophy FastAPI Backend

Thin wrapper around the Anthropic Claude API for two core tasks:
  1. Structured profile extraction from resume text
  2. Smart field-to-profile matching

Requires: ANTHROPIC_API_KEY environment variable (set in .env).
Model:     claude-3-5-haiku-20241022  (fast + cost-effective for structured extraction)
"""

import os
import json
from typing import Any

import anthropic

# ─── Client setup ─────────────────────────────────────────────
# Reads ANTHROPIC_API_KEY from the environment automatically.
# Load your .env file before starting the server:
#   from dotenv import load_dotenv; load_dotenv()
client = anthropic.Anthropic()

AI_MODEL     = os.getenv("FILLOSOPHY_AI_MODEL", "claude-3-5-haiku-20241022")
MAX_TOKENS   = 2048

# ─── Profile extraction ───────────────────────────────────────

async def extract_profile_from_text(resume_text: str) -> dict[str, Any]:
    """
    Uses Claude to parse raw resume text into a structured profile dict.

    Expected output schema:
        {
            "name":           str,
            "email":          str,
            "phone":          str,
            "address":        str,
            "linkedin":       str,
            "github":         str,
            "summary":        str,
            "skills":         list[str],
            "experience":     list[{ "title": str, "company": str, "duration": str, "description": str }],
            "education":      list[{ "degree": str, "institution": str, "year": str, "cgpa": str }],
            "certifications": list[str],
        }

    Args:
        resume_text: Plain text extracted from the resume file.

    Returns:
        dict: Structured profile data parsed from the LLM response.

    Raises:
        ValueError: If the LLM response cannot be parsed as JSON.
        anthropic.APIError: On API-level failures.

    TODO: Wire this into routes/extract.py once the pipeline is tested.
    """
    prompt = _build_extraction_prompt(resume_text)

    response = client.messages.create(
        model=AI_MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Claude returned non-JSON output. Raw response:\n{raw}"
        ) from exc


# ─── Field matching ───────────────────────────────────────────

async def match_fields_to_profile(
    fields: list[Any],
    profile: dict[str, Any],
) -> dict[str, Any]:
    """
    Uses Claude to map detected form fields to the most appropriate
    values from the user's profile.

    Args:
        fields:  List of field descriptor strings or dicts from the content script.
        profile: Parsed profile dict from extract_profile_from_text().

    Returns:
        dict: Mapping of field identifier → suggested fill value.
              e.g. { "email_address": "aditya@example.com", "full_name": "Aditya Jain" }

    Raises:
        ValueError: If the LLM response cannot be parsed as JSON.
        anthropic.APIError: On API-level failures.

    TODO: Wire this into routes/match.py once the pipeline is tested.
    """
    prompt = _build_match_prompt(fields, profile)

    response = client.messages.create(
        model=AI_MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Claude returned non-JSON output. Raw response:\n{raw}"
        ) from exc


# ─── Internal helpers ─────────────────────────────────────────

def _build_extraction_prompt(resume_text: str) -> str:
    """Builds the user prompt for profile extraction."""
    return (
        "You are a precise resume parser. Extract structured information from "
        "the following resume text and return ONLY a valid JSON object — no "
        "markdown, no explanation.\n\n"
        "Required JSON keys: name, email, phone, address, linkedin, github, "
        "summary, skills (array), experience (array of objects with title, "
        "company, duration, description), education (array of objects with "
        "degree, institution, year, cgpa), certifications (array).\n\n"
        "If a field is not found in the resume, use null.\n\n"
        f"Resume text:\n{resume_text}"
    )


def _build_match_prompt(fields: list[Any], profile: dict[str, Any]) -> str:
    """Builds the user prompt for form-field-to-profile matching."""
    fields_json  = json.dumps(fields, indent=2)
    profile_json = json.dumps(profile, indent=2)

    return (
        "You are an intelligent form-filling assistant.\n"
        "Given the detected form fields below, map each to the most appropriate "
        "value from the user profile. Return ONLY a valid JSON object where "
        "keys are the field identifiers and values are the fill values.\n"
        "If a field cannot be matched, omit it from the response.\n\n"
        f"Form fields:\n{fields_json}\n\n"
        f"User profile:\n{profile_json}"
    )
