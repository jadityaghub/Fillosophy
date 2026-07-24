# Switching Fillosophy to Supabase Cloud Database

## Overview

Fillosophy supports dual database backends:
- **SQLite** (`DB_BACKEND=sqlite`): Default local file storage (`fillosophy.db`).
- **Supabase** (`DB_BACKEND=supabase`): Cloud-hosted PostgreSQL database for multi-device sync.

---

## Step 1 — Create a Supabase Project

1. Sign up at <https://supabase.com>
2. Create a new project
3. Navigate to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_KEY`

---

## Step 2 — Run the Consolidated Database Schema

1. Open the **SQL Editor** in your Supabase dashboard
2. Copy and run the contents of [`database/schema.sql`](database/schema.sql):

```sql
-- Consolidated Fillosophy Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for fast profile lookup by name
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles(name);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE OR REPLACE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to profiles" ON public.profiles
    FOR ALL USING (true) WITH CHECK (true);
```

---

## Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```
*(Includes `supabase>=2.0.0`)*

---

## Step 4 — Configure Environment Variables

In `backend/.env`, set:

```env
DB_BACKEND=supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
```

---

## Step 5 — Verify

Start the FastAPI backend:

```bash
uvicorn main:app --reload --port 8000
```

You will see:
```text
[Fillosophy DB] Using Supabase cloud backend
[Fillosophy Supabase] Connected to Supabase at https://your-project-id...
```

You can toggle back to local SQLite at any time by setting `DB_BACKEND=sqlite`.
