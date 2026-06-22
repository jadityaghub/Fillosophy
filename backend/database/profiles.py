# Fillosophy — SQLite persistence layer for resume profiles
"""
database/profiles.py

Provides a lightweight SQLite-backed store for named resume profiles.

Schema:
    profiles (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT UNIQUE NOT NULL,
        data       TEXT NOT NULL,          -- JSON-serialised profile dict
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )

The database file is created at backend/fillosophy.db on first run.
Call init_db() once at application startup (wired via main.py @on_event).
"""

import json
import sqlite3
from pathlib import Path
from typing import Any

# ─── Database path ─────────────────────────────────────────────
# Stored relative to this file's directory (backend/fillosophy.db)
DB_PATH = Path(__file__).parent.parent / "fillosophy.db"


# ─── Initialisation ────────────────────────────────────────────

def init_db() -> None:
    """
    Creates the SQLite database file and the profiles table if they
    do not already exist. Safe to call multiple times (idempotent).

    Called automatically by main.py on server startup.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT UNIQUE NOT NULL,
                data       TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    print(f"[Fillosophy DB] Database ready at: {DB_PATH}")


# ─── CRUD helpers ──────────────────────────────────────────────

async def save_profile(profile: dict[str, Any], profile_id: str) -> None:
    """
    Inserts or replaces a profile by name.

    Args:
        profile:    Structured profile data dict (will be JSON-serialised).
        profile_id: Unique profile label (e.g. "academic", "personal").
    """
    data_json = json.dumps(profile)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO profiles (name, data) VALUES (?, ?)"
            " ON CONFLICT(name) DO UPDATE SET data = excluded.data",
            (profile_id, data_json),
        )
        conn.commit()


async def get_profile(profile_id: str) -> dict[str, Any] | None:
    """
    Retrieves a profile by name.

    Args:
        profile_id: The profile label to look up.

    Returns:
        The profile dict, or None if not found.
    """
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT data FROM profiles WHERE name = ?", (profile_id,)
        ).fetchone()
    return json.loads(row[0]) if row else None


async def delete_profile(profile_id: str) -> bool:
    """
    Removes a profile by name.

    Args:
        profile_id: The profile label to delete.

    Returns:
        True if a row was deleted, False if it did not exist.
    """
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "DELETE FROM profiles WHERE name = ?", (profile_id,)
        )
        conn.commit()
    return cursor.rowcount > 0


async def list_profiles() -> list[str]:
    """
    Returns the names of all stored profiles.

    Returns:
        List of profile name strings, ordered by creation time.
    """
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT name FROM profiles ORDER BY created_at ASC"
        ).fetchall()
    return [row[0] for row in rows]
