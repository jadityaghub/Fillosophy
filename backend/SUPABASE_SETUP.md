# Switching Fillosophy to Supabase

## Why Supabase?

SQLite stores profiles in a local file (`fillosophy.db`) on the device
running the backend. Supabase stores profiles in a hosted PostgreSQL
database, making them accessible from any device.

---

## Step 1 — Create a Supabase project

1. Go to <https://supabase.com> and create a free account
2. Create a new project
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_KEY`

---

## Step 2 — Create the profiles table

Run this SQL in the **Supabase SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Step 3 — Install supabase-py

```bash
pip install supabase
```

Add `supabase` to `requirements.txt`.

---

## Step 4 — Implement supabase_db.py

Replace the `NotImplementedError` stubs in
[`database/supabase_db.py`](database/supabase_db.py)
with real Supabase client calls:

```python
from supabase import create_client

# In __init__:
self.client = create_client(self.url, self.key)

# save_profile
self.client.table("profiles").upsert(
    {"name": name, "data": data}
).execute()

# get_profile
result = self.client.table("profiles") \
    .select("data").eq("name", name).execute()
return result.data[0]["data"] if result.data else None

# list_profiles
result = self.client.table("profiles").select("name").execute()
return [row["name"] for row in result.data]

# delete_profile
self.client.table("profiles").delete().eq("name", name).execute()
```

---

## Step 5 — Switch the backend

In your `.env` file, change:

```env
DB_BACKEND=supabase
```

Restart the backend. The selector in
[`database/profiles.py`](database/profiles.py)
will automatically route all calls to `SupabaseProfileDB`.

SQLite is untouched and can be switched back at any time by
setting `DB_BACKEND=sqlite`.
