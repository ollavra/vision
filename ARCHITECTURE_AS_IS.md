# Architecture as-is

## Runtime

- Vercel serves the Vite/React single-page application.
- Render runs the Express API in `src/server`.
- Supabase provides authentication and Postgres persistence.
- OpenRouter provides the existing AI completion route.

## Authentication and authorization

The frontend obtains a Supabase session through `/api/signup` or `/api/login`. Protected requests send the access token in the `Authorization: Bearer` header. The API validates the token with Supabase Auth and creates a request-scoped Supabase client carrying the same JWT. Database RLS then restricts rows to the authenticated user's UUID.

The backend does not use a service-role key for user-data requests. An explicit `user_id` predicate on journal listing adds defense in depth but does not replace RLS.

## Data model

- `thoughts`: published journal entries, including same-owner parent branches.
- `chat_sessions`: mode and context choice for a conversation.
- `messages`: ordered user, assistant and system content owned through a session.
- `user_settings`: one settings row per Auth user.

Composite foreign keys ensure a thought, parent thought, session and message cannot be linked across owners. Deleting an Auth user cascades only that user's diary records; this release does not delete or modify any existing Auth user.

## Deployment boundary

The migration is versioned in source control and is not automatically applied by the application. Environment values stay outside Git. `SUPABASE_ANON_KEY` is used by the backend together with each user's JWT; `OPENROUTER_API_KEY` remains server-only.
