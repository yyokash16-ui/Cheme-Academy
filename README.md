# ChemE Academy

React + TypeScript starter for a Chemical Engineering learning platform with Student, Tutor, and Owner experiences.

## Status
This is an initial starter UI, not a production-ready LMS. Demo actions may be temporary until backend wiring and security testing are completed. Payment processing is intentionally not configured.

## Local build

```bash
npm install
npm run dev
npm run build
```

## Configuration
Use `.env.example` as a template. Never commit credentials or server-side database connection strings.

## Backend
The initial UI source has Supabase client integration while a separate Neon PostgreSQL schema was prepared in project planning. Do not enter the Neon owner connection string into browser variables. Before production, implement a secure server-side API and finish authentication, approval, authorization, and persistent data workflows.
