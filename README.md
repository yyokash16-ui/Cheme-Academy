# ChemE Academy

A mobile-first React + TypeScript portal for Diploma Chemical Engineering learning and career preparation. The UI contains Student, Tutor, and Owner-oriented views, a course catalogue, lesson library, live-class schedule, announcements, and account forms.

## Build and run

```bash
npm install
npm run dev
npm run build
```

The GitHub Actions workflow checks the build on pushes and pull requests. The frontend uses Vite and can be hosted on Vercel.

## Install ChemE Academy

The website can be installed from a supported browser as an app on Android, iPhone, and desktop. Open the live site over HTTPS and use the **Install** button or your browser's install option. On iPhone, open the site in Safari, tap **Share**, then choose **Add to Home Screen**.

The installed app uses the same online Neon sign-in and account data as the website. It caches the app shell only; account and owner API responses are never stored for offline use.

## Current implementation status

The account portal uses Neon Auth for sign-in and Neon Postgres for server-side profiles. On first request, the API idempotently creates or updates the tables needed by the account-review workflow. Every signed-in account gets the regular learning workspace immediately; the configured owner can approve or decline requests for additional teaching tools. The course, lesson, class, announcement, and enrolment workflows are still an evolving LMS foundation, so validate those specific write paths before relying on them operationally.

## Account registration and owner access

- Configure `OWNER_EMAIL` as a server-side Vercel environment variable with the exact email address that should own the academy. The matching account is provisioned as the owner on sign-in; do not let public registration choose or change this value.
- Configure `DATABASE_URL` as a server-side Neon connection string. Never use a `VITE_` prefix for either variable.
- New registrations appear in the private account review list from Neon Auth, including before the user signs in for the first time. First sign-in creates a persistent profile automatically. Every signed-in account immediately gets the normal learning experience. The notification bell shows the number awaiting review. The owner can approve or decline requests for additional learning/teaching tools; internal access values are not shown as account modes in the interface.
- Only the configured owner email can access `/api/owner`. Other accounts can be approved as students or tutors; the owner role cannot be granted through the public approval action.

## Backend and security

- `DATABASE_URL` is server-side only and points to the Neon PostgreSQL database.
- `OWNER_EMAIL` is server-side only and is compared against the authenticated email on the server. A matching account is provisioned as the owner on sign-in.
- The API initializes the account and content tables idempotently when first used. Keep the database user scoped to the ChemE Academy database.
- Never expose database credentials with a `VITE_` prefix or allow public registration requests to grant owner access.

The repository also contains legacy Supabase scaffolding; it is not the database connection used by the current account-review API.

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
