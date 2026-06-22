"""
routes/match.py — Fillosophy FastAPI Backend

Maps detected form fields to the best-matching profile values.

POST /match
    Accepts a stored profile (dict) and a list of field descriptors,
    then returns a suggested fill value for each field using AI matching.

Current state: placeholder — echoes the field count only.
Next step: wire up utils/ai_client.match_fields_to_profile().
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


# ─── Request schema ───────────────────────────────────────────

class MatchRequest(BaseModel):
    """
    Payload sent by the content script with the current page's form fields
    and the active user profile to match against.
    """
    profile: dict = Field(
        ...,
        description="Structured profile dict as returned by the /extract endpoint.",
        example={
            "name": "Aditya Jain",
            "email": "aditya@example.com",
            "phone": "+91-9999999999",
            "degree": "B.Tech Computer Science",
            "cgpa": "9.2",
            "skills": ["Python", "FastAPI", "React"],
        },
    )
    fields: list[str] = Field(
        ...,
        description="List of form field descriptors detected on the page (name, id, placeholder, etc.).",
        example=["full_name", "email_address", "phone_number", "highest_qualification"],
    )


# ─── Route ────────────────────────────────────────────────────

@router.post(
    "/",
    summary="Match form fields to profile values",
    response_description="Suggested fill values keyed by field descriptor",
)
async def match_fields(payload: MatchRequest) -> dict:
    """
    Receives the active profile and a list of form field descriptors,
    then returns the best-matching profile value for each field.

    Args:
        payload: MatchRequest containing the profile dict and field list.

    Returns:
        dict: Matching result with a `matches` map (field → value).

    TODO: Replace the placeholder with a real call to
          utils/ai_client.match_fields_to_profile().
    """
    # ── TODO: AI field matching ───────────────────────────────
    # matches = await match_fields_to_profile(payload.fields, payload.profile)

    # Placeholder response — real matches dict replaces `fields_received`
    return {
        "status": "match placeholder",
        "fields_received": len(payload.fields),
    }
