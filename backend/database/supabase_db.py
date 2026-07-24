"""
Fillosophy — Supabase database implementation.
Stores profiles in a hosted Supabase PostgreSQL table.
Requires SUPABASE_URL and SUPABASE_KEY environment variables.
"""

import logging
import os

from database.base import ProfileDB

logger = logging.getLogger(__name__)
LOG_PREFIX = "[Fillosophy Supabase]"


class SupabaseProfileDB(ProfileDB):
    """
    Supabase-backed profile store.
    Communicates with the hosted Supabase PostgreSQL REST API via supabase-py.
    """

    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL", "")
        self.key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
        self._client = None

    @property
    def client(self):
        """Lazy initializer for the Supabase client."""
        if self._client is None:
            if not self.url or not self.key:
                raise ValueError(
                    f"{LOG_PREFIX} SUPABASE_URL and SUPABASE_KEY must be set in environment."
                )
            try:
                from supabase import create_client
                self._client = create_client(self.url, self.key)
                logger.info("%s Connected to Supabase at %s", LOG_PREFIX, self.url[:30])
            except ImportError as err:
                raise ImportError(
                    f"{LOG_PREFIX} 'supabase' package is not installed. Run 'pip install supabase'."
                ) from err
        return self._client

    # ─── Schema ───────────────────────────────────────────────────────────────

    def init_db(self) -> None:
        """Verify Supabase connection and schema access."""
        try:
            logger.info("%s Verifying database connection...", LOG_PREFIX)
            self.client.table("profiles").select("count", count="exact").limit(1).execute()
            logger.info("%s Database connection verified.", LOG_PREFIX)
        except Exception as exc:
            logger.warning("%s Database initialization check: %s", LOG_PREFIX, exc)

    # ─── Write ────────────────────────────────────────────────────────────────

    def save_profile(self, name: str, data: dict) -> None:
        """Insert or update a profile by name."""
        try:
            logger.info("%s Saving profile '%s'.", LOG_PREFIX, name)
            res = self.client.table("profiles").upsert(
                {"name": name, "data": data},
                on_conflict="name"
            ).execute()
            logger.info("%s Profile '%s' saved successfully.", LOG_PREFIX, name)
            return res.data
        except Exception as exc:
            raise RuntimeError(
                f"{LOG_PREFIX} Failed to save profile '{name}': {exc}"
            ) from exc

    # ─── Read ─────────────────────────────────────────────────────────────────

    def get_profile(self, name: str) -> dict | None:
        """Return the profile dict for name, or None if not found."""
        try:
            logger.info("%s Fetching profile '%s'.", LOG_PREFIX, name)
            res = self.client.table("profiles").select("data").eq("name", name).execute()
            if res.data and len(res.data) > 0:
                logger.info("%s Profile '%s' retrieved.", LOG_PREFIX, name)
                return res.data[0].get("data")
            logger.info("%s Profile '%s' not found.", LOG_PREFIX, name)
            return None
        except Exception as exc:
            raise RuntimeError(
                f"{LOG_PREFIX} Failed to retrieve profile '{name}': {exc}"
            ) from exc

    def list_profiles(self) -> list[str]:
        """Return a list of all profile names ordered by creation time."""
        try:
            logger.info("%s Listing all profiles.", LOG_PREFIX)
            res = self.client.table("profiles").select("name").order("created_at", desc=False).execute()
            names = [row["name"] for row in (res.data or [])]
            logger.info("%s Found %d profile(s).", LOG_PREFIX, len(names))
            return names
        except Exception as exc:
            raise RuntimeError(
                f"{LOG_PREFIX} Failed to list profiles: {exc}"
            ) from exc

    # ─── Delete ───────────────────────────────────────────────────────────────

    def delete_profile(self, name: str) -> None:
        """Delete the profile with the given name."""
        try:
            logger.info("%s Deleting profile '%s'.", LOG_PREFIX, name)
            self.client.table("profiles").delete().eq("name", name).execute()
            logger.info("%s Profile '%s' deleted.", LOG_PREFIX, name)
        except Exception as exc:
            raise RuntimeError(
                f"{LOG_PREFIX} Failed to delete profile '{name}': {exc}"
            ) from exc
