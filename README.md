# ChemE Academy

A mobile-first React + TypeScript portal for Diploma Chemical Engineering learning and career preparation. The UI contains Student, Tutor, and Owner-oriented views, a course catalogue, lesson library, live-class schedule, announcements, and account forms.

## Build and run

```bash
npm install
npm run dev
npm run build
```

The GitHub Actions workflow checks the build on pushes and pull requests. The frontend uses Vite and can be hosted on Vercel.

## Current implementation status

This repository is an **initial UI foundation, not a production-ready LMS**. Without valid backend configuration it runs in demo mode: content and course-enquiry changes are temporary. Supabase Auth/profile lookup is present as a partial integration, but most course, lesson, class, announcement, and enrolment mutations are not wired to persistent CRUD workflows. Do not collect real student information or sell access until authorization is wired and tested.

## Account registration and owner access

- Configure `OWNER_EMAIL` as a server-side Vercel environment variable with the exact email address that should own the academy. The matching account is provisioned as the owner on sign-in; do not let public registration choose or change this value.
- Configure `DATABASE_URL` as a server-side Neon connection string. Never use a `VITE_` prefix for either variable.
- A first-time authenticated sign-in creates a persistent profile automatically. Every signed-in account immediately gets the normal learning experience. New account emails appear in the private account review list, and the notification bell shows the number awaiting review. The owner can approve or decline requests for additional learning/teaching tools; the interface does not expose internal access-mode names.
- Only the configured owner email can access `/api/owner`. Other accounts can be approved as students or tutors; the owner role cannot be granted through the public approval action.

## Backend and security

The included SQL file is a draft migration targeting a **separate Supabase project**, while a Neon PostgreSQL database was prepared separately in project planning. These are not interchangeable configuration choices: the browser client currently imports Supabase, not Neon. Before production, decide the backend architecture, implement a secure server-side API if using Neon, validate the RLS/policies, finish owner approval/tutor assignment workflows, and test with separate accounts. Never place a privileged database connection string or service-role secret in browser code or a `VITE_` variable.

To configure this current UI for local Supabase Auth, copy `.env.example` to `.env.local` and provide only a dedicated project's Supabase URL and publishable key. Do not reuse the Be Productive or ReConstruct projects. Owner bootstrap must be performed privately using the verified account UUID, never through public registration.

## Course access and payments

Course fees remain enquiry-only. Payment processing is intentionally not configured. An approval state or enrolment request is not proof of payment, and protected content must not be exposed before access rules are fully implemented and tested.

## Before launch

- Install dependencies and ensure `npm run build` passes.
- Apply and review the migration only on a dedicated ChemE Academy Supabase project if Supabase is selected.
- Test RLS with student, tutor, and owner accounts, including direct API requests.
- Finish persistent CRUD for courses, lessons, classes, announcements and enrolments.
- Ensure unapproved students cannot access course material and tutors cannot change owner settings.
- Configure authentication redirect URLs, backups, privacy terms, retention controls and protected video storage.
- Add server-side validation, rate limiting and accessibility/error/loading checks.

No production backend credentials are committed in this repository.
