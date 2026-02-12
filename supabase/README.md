# Supabase schema

## Jobs table

The app expects a `public.jobs` table with:

| Column            | Type         | Notes                          |
|-------------------|--------------|--------------------------------|
| id                | uuid         | PK, default `gen_random_uuid()`|
| title             | text         | NOT NULL                       |
| company           | text         | NOT NULL                       |
| location          | text         | NOT NULL, default ''           |
| category          | text         | nullable                       |
| description       | text         | nullable                       |
| publication_date  | timestamptz  | nullable                       |
| apply_url         | text         | NOT NULL, **unique**           |
| experience_level  | text         | nullable                       |
| created_at        | timestamptz  | NOT NULL, default now()        |
| updated_at        | timestamptz  | optional                       |

- **Unique on `apply_url`** so the same job isn’t stored twice when ingesting from Remotive/ArbeitNow.

## How to run migrations

**Option A – Supabase Dashboard**

1. Open your project → **SQL Editor**.
2. New query → paste the contents of `migrations/20240206120000_create_jobs_table.sql` → Run.
3. If you already had a `jobs` table, run `migrations/20240206120001_alter_jobs_if_exists.sql` instead (or after) to add missing columns and the unique constraint.

**Option B – Supabase CLI**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Migrations run in filename order. RLS is enabled so anyone can read jobs; writes go through your API using the service role key.
