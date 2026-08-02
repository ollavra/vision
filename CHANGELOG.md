# Changelog

## 0.1.0-pre-alpha - 2026-08-02

### Added

- Versioned Supabase schema for `thoughts`, `chat_sessions`, `messages` and `user_settings`.
- Row Level Security and per-operation ownership policies for all diary tables.
- Environment variable template and project architecture/status documentation.
- Switchable Editor and Dialogue modes throughout a session.
- Voice transcript punctuation through the existing OpenRouter provider, with word-preservation validation.
- Editable generated Journal entries with title, date, publish and return-to-session actions.
- Optional isolation from previously published Journal context while always preserving current-session context.

### Security

- Require a valid Supabase JWT for `/api/chat` and both journal endpoints.
- Run user-data queries with a request-scoped Supabase client so RLS is enforced.
- Filter journal reads explicitly by the authenticated user's UUID.
- Prevent cross-user parent/session relationships with composite foreign keys.

### Unchanged

- Visual design and existing AI model/provider configuration.
