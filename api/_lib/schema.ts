// Idempotent Neon/Postgres schema bootstrap for the academy API.
// The first API request prepares the tables needed by account review and the portal.
// Keep this migration server-side; never expose DATABASE_URL to browser code.
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureAcademySchema(sql: any): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        create table if not exists public.user_profiles (
          id text primary key,
          email text not null unique,
          display_name text not null default '',
          role text not null default 'student',
          approval_status text not null default 'pending',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          last_login_at timestamptz,
          approved_by text,
          approved_at timestamptz
        )
      `;
      await sql`
        create table if not exists public.courses (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          slug text not null unique,
          description text not null default '',
          subject_area text not null default 'Chemical Engineering',
          level text not null default 'undergraduate',
          status text not null default 'draft',
          access_type text not null default 'approval_required',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          created_by text
        )
      `;
      await sql`
        create table if not exists public.lessons (
          id uuid primary key default gen_random_uuid(),
          course_id uuid not null,
          title text not null,
          description text not null default '',
          subject_area text,
          content_markdown text not null default '',
          video_url text,
          resource_url text,
          sort_order integer not null default 0,
          status text not null default 'draft',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          created_by text
        )
      `;
      await sql`
        create table if not exists public.live_classes (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          description text not null default '',
          course_id uuid,
          tutor_user_id text,
          starts_at timestamptz not null,
          duration_minutes integer not null default 60,
          meeting_url text,
          status text not null default 'scheduled',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists public.announcements (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          body text not null,
          audience text not null default 'all',
          published boolean not null default false,
          created_by text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists public.enrollment_requests (
          id uuid primary key default gen_random_uuid(),
          student_user_id text not null,
          course_id uuid not null,
          status text not null default 'pending',
          reviewed_by text,
          reviewed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (student_user_id, course_id)
        )
      `;

      // Add only columns that the current Neon schema has not needed historically.
      await sql`alter table public.lessons add column if not exists subject_area text`;
      await sql`alter table public.live_classes add column if not exists updated_at timestamptz not null default now()`;
      await sql`alter table public.announcements add column if not exists updated_at timestamptz not null default now()`;
      await sql`alter table public.enrollment_requests add column if not exists updated_at timestamptz not null default now()`;
      schemaReady = true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}
