-- ==============================================================================
-- Fillosophy — Supabase Database Schema (PostgreSQL)
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to create the single consolidated profiles table.
-- ==============================================================================

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create unique index on profile name for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles(name);

-- 3. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 4. Attach trigger to profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Row Level Security (RLS) configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public / service role full access to profiles
CREATE POLICY "Allow full access to profiles" ON public.profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);
