-- ChemE Academy initial schema.
-- Apply ONLY to a new, dedicated ChemE Academy Supabase project.
-- Never apply this to Be Productive or ReConstruct.
create extension if not exists pgcrypto;

create type public.academy_role as enum ('student','tutor','owner');
create type public.approval_state as enum ('pending','approved','rejected','suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.academy_role not null default 'student',
  approval_status public.approval_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  category text not null default 'Chemical Engineering',
  syllabus text not null default '',
  price_inr integer,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_price_nonnegative check (price_inr is null or price_inr >= 0)
);
create table public.course_tutors (
  course_id uuid not null references public.courses(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(course_id,tutor_id)
);
create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'requested' check(status in ('requested','approved','rejected','revoked')),
  payment_status text not null default 'not_integrated' check(payment_status in ('not_integrated','pending','paid','failed','refunded','waived')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  unique(student_id,course_id)
);
create table public.live_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  meeting_url text,
  tutor_id uuid references public.profiles(id),
  published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  subject text not null default 'Chemical Engineering',
  description text not null default '',
  video_url text,
  resource_url text,
  position integer not null default 0,
  published boolean not null default false,
  created_by uuid not null references public.profiles(id)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all' check(audience in ('all','students','tutors')),
  published boolean not null default false,
  created_by uuid not null references public.profiles(id)
);

-- Role checks use a protected profile, never user-editable auth metadata.
create function public.current_role() returns public.academy_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved' limit 1
$$;
revoke all on function public.current_role() from public;
grant execute on function public.current_role() to anon, authenticated;
create function public.is_owner() returns boolean language sql stable security invoker set search_path = '' as $$ select coalesce(public.current_role()='owner',false) $$;
create function public.is_tutor() returns boolean language sql stable security invoker set search_path = '' as $$ select coalesce(public.current_role()='tutor',false) $$;
create function public.has_course_access(target_course uuid) returns boolean language sql stable security invoker set search_path = '' as $$
 select public.is_owner()
 or exists(select 1 from public.course_tutors ct where ct.course_id=target_course and ct.tutor_id=(select auth.uid()) and public.is_tutor())
 or exists(select 1 from public.enrolments e where e.course_id=target_course and e.student_id=(select auth.uid()) and e.status='approved' and e.payment_status in ('paid','waived') and public.current_role()='student')
$$;

create function public.handle_new_academy_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,role,approval_status) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),'student','pending');
 return new;
end;
$$;
create trigger on_auth_user_created_cheme after insert on auth.users for each row execute procedure public.handle_new_academy_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_tutors enable row level security;
alter table public.enrolments enable row level security;
alter table public.live_classes enable row level security;
alter table public.lessons enable row level security;
alter table public.announcements enable row level security;

create policy "profile read self or owner" on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_owner());
create policy "owner manages profiles" on public.profiles for update to authenticated using(public.is_owner()) with check(public.is_owner());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;
create policy "published courses visible" on public.courses for select to anon, authenticated using(published or public.is_owner() or public.has_course_access(id) or exists(select 1 from public.course_tutors ct where ct.course_id=id and ct.tutor_id=(select auth.uid())));
create policy "owners manage courses" on public.courses for all to authenticated using(public.is_owner()) with check(public.is_owner());
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
create policy "course tutor assignments visible to owner or assigned tutor" on public.course_tutors for select to authenticated using(public.is_owner() or tutor_id=(select auth.uid()));
create policy "owners assign tutors" on public.course_tutors for all to authenticated using(public.is_owner()) with check(public.is_owner());
grant select, insert, update, delete on public.course_tutors to authenticated;
create policy "student sees own enrolments owner sees all" on public.enrolments for select to authenticated using(student_id=(select auth.uid()) or public.is_owner() or exists(select 1 from public.course_tutors ct where ct.course_id=enrolments.course_id and ct.tutor_id=(select auth.uid())));
create policy "students request enrolment" on public.enrolments for insert to authenticated with check(student_id=(select auth.uid()) and public.current_role()='student' and status='requested' and payment_status='not_integrated');
create policy "owner reviews enrolments" on public.enrolments for update to authenticated using(public.is_owner()) with check(public.is_owner());
grant select, insert, update on public.enrolments to authenticated;
create policy "published live classes visible with access" on public.live_classes for select to authenticated using((published and public.has_course_access(course_id)) or public.is_owner() or public.is_tutor());
create policy "approved tutors create live classes" on public.live_classes for insert to authenticated with check(public.is_tutor() and created_by=(select auth.uid()));
create policy "tutors and owners update live classes" on public.live_classes for update to authenticated using(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid()))) with check(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid())));
create policy "owners delete live classes" on public.live_classes for delete to authenticated using(public.is_owner());
grant select, insert, update, delete on public.live_classes to authenticated;
create policy "published lessons visible with course access" on public.lessons for select to authenticated using((published and public.has_course_access(course_id)) or public.is_owner() or public.is_tutor());
create policy "approved tutors create lessons" on public.lessons for insert to authenticated with check(public.is_tutor() and created_by=(select auth.uid()));
create policy "tutors and owners update lessons" on public.lessons for update to authenticated using(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid()))) with check(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid())));
create policy "owners delete lessons" on public.lessons for delete to authenticated using(public.is_owner());
grant select, insert, update, delete on public.lessons to authenticated;
create policy "published announcements visible to audience" on public.announcements for select to anon, authenticated using(published and audience='all' or public.is_owner() or (public.is_tutor() and audience='tutors') or (public.current_role()='student' and audience='students'));
create policy "approved tutors create announcements" on public.announcements for insert to authenticated with check((public.is_owner() or public.is_tutor()) and created_by=(select auth.uid()));
create policy "owners and creators update announcements" on public.announcements for update to authenticated using(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid()))) with check(public.is_owner() or (public.is_tutor() and created_by=(select auth.uid())));
create policy "owners delete announcements" on public.announcements for delete to authenticated using(public.is_owner());
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

-- Important owner bootstrap: after signup and email verification, use your verified auth user UUID in private SQL editor; never expose a public self-promotion function.
