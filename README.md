# [+vision] Diary

Pre-alpha AI diary with a Vite/React frontend, an Express backend and Supabase Auth/Postgres.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and provide the server-side values.
3. Apply migrations in `supabase/migrations` to the intended Supabase project.
4. Start the frontend build with `npm run build` or the backend with `npm start`.

Never put `SUPABASE_SERVICE_KEY` or `OPENROUTER_API_KEY` in frontend variables. The browser keeps the Supabase access token returned at login and sends it as a Bearer token to protected backend endpoints.

## Security model

- `/api/chat` and `/api/thoughts` require a valid Supabase access token.
- Database calls are made with that user's JWT, so Row Level Security is enforced.
- Every diary table has ownership policies based on `(select auth.uid()) = user_id`.
- Server queries also filter by `user_id` where a user-scoped list is returned.

See `STATUS.md` and `ARCHITECTURE_AS_IS.md` for current limitations and deployment notes.
