// Idempotent Neon/Postgres schema bootstrap for the academy API.
// The first authenticated sign-in creates the tables needed by account review.
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
          email text not null,
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
      await sql`alter table public.user_profiles add column if not exists email text`;
      await sql`alter table public.user_profiles add column if not exists display_name text not null default ''`;
      await sql`alter table public.user_profiles add column if not exists role text not null default 'student'`;
      await sql`alter table public.user_profiles add column if not exists approval_status text not null default 'pending'`;
      await sql`alter table public.user_profiles add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.user_profiles add column if not exists updated_at timestamptz not null default now()`;
      await sql`alter table public.user_profiles add column if not exists last_login_at timestamptz`;
      await sql`alter table public.user_profiles add column if not exists approved_by text`;
      await sql`alter table public.user_profiles add column if not exists approved_at timestamptz`;

      await sql`
        create table if not exists public.courses (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          slug text not null,
          description text,
          subject_area text,
          level text,
          status text not null default 'draft',
          access_type text not null default 'approval_required',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          created_by text
        )
      `;
      await sql`alter table public.courses add column if not exists title text not null default ''`;
      await sql`alter table public.courses add column if not exists slug text not null default ''`;
      await sql`alter table public.courses add column if not exists description text`;
      await sql`alter table public.courses add column if not exists subject_area text`;
      await sql`alter table public.courses add column if not exists level text`;
      await sql`alter table public.courses add column if not exists status text not null default 'draft'`;
      await sql`alter table public.courses add column if not exists access_type text not null default 'approval_required'`;
      await sql`alter table public.courses add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.courses add column if not exists updated_at timestamptz not null default now()`;
      await sql`alter table public.courses add column if not exists created_by text`;

      await sql`
        create table if not exists public.lessons (
          id uuid primary key default gen_random_uuid(),
          course_id uuid not null,
          title text not null,
          description text,
          subject_area text,
          video_url text,
          resource_url text,
          status text not null default 'draft',
          sort_order integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`alter table public.lessons add column if not exists course_id uuid`;
      await sql`alter table public.lessons add column if not exists title text not null default ''`;
      await sql`alter table public.lessons add column if not exists description text`;
      await sql`alter table public.lessons add column if not exists subject_area text`;
      await sql`alter table public.lessons add column if not exists video_url text`;
      await sql`alter table public.lessons add column if not exists resource_url text`;
      await sql`alter table public.lessons add column if not exists status text not null default 'draft'`;
      await sql`alter table public.lessons add column if not exists sort_order integer not null default 0`;
      await sql`alter table public.lessons add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.lessons add column if not exists updated_at timestamptz not null default now()`;

      await sql`
        create table if not exists public.live_classes (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          description text not null default '',
          starts_at timestamptz not null,
          duration_minutes integer not null default 60,
          status text not null default 'scheduled',
          meeting_url text,
          tutor_user_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`alter table public.live_classes add column if not exists title text not null default ''`;
      await sql`alter table public.live_classes add column if not exists description text not null default ''`;
      await sql`alter table public.live_classes add column if not exists starts_at timestamptz`;
      await sql`alter table public.live_classes add column if not exists duration_minutes integer not null default 60`;
      await sql`alter table public.live_classes add column if not exists status text not null default 'scheduled'`;
      await sql`alter table public.live_classes add column if not exists meeting_url text`;
      await sql`alter table public.live_classes add column if not exists tutor_user_id text`;
      await sql`alter table public.live_classes add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.live_classes add column if not exists updated_at timestamptz not null default now()`;

      await sql`
        create table if not exists public.announcements (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          body text not null,
          audience text not null default 'all',
          published boolean not null default false,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          created_by text
        )
      `;
      await sql`alter table public.announcements add column if not exists title text not null default ''`;
      await sql`alter table public.announcements add column if not exists body text not null default ''`;
      await sql`alter table public.announcements add column if not exists audience text not null default 'all'`;
      await sql`alter table public.announcements add column if not exists published boolean not null default false`;
      await sql`alter table public.announcements add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.announcements add column if not exists updated_at timestamptz not null default now()`;
      await sql`alter table public.announcements add column if not exists created_by text`;

      await sql`
        create table if not exists public.enrollment_requests (
          id uuid primary key default gen_random_uuid(),
          student_user_id text not null,
          course_id uuid not null,
          status text not null default 'pending',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`alter table public.enrollment_requests add column if not exists student_user_id text`;
      await sql`alter table public.enrollment_requests add column if not exists course_id uuid`;
      await sql`alter table public.enrollment_requests add column if not exists status text not null default 'pending'`;
      await sql`alter table public.enrollment_requests add column if not exists created_at timestamptz not null default now()`;
      await sql`alter table public.enrollment_requests add column if not exists updated_at timestamptz not null default now()`;

      await sql`create index if not exists user_profiles_review_queue_idx on public.user_profiles (approval_status, created_at desc)`;
      await sql`create index if not exists courses_status_title_idx on public.courses (status, title)`;
      await sql`create index if not exists live_classes_status_start_idx on public.live_classes (status, starts_at)`;
      await sql`create index if not exists announcements_published_created_idx on public.announcements (published, created_at desc)`;
      schemaReady = true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}
