# Status

Version: `0.1.0-pre-alpha`

## Included

- Email/password authentication through Supabase Auth.
- Authenticated AI chat using the existing OpenRouter model configuration.
- Personal journal entries and `++ thought` parent relationships.
- Versioned schema for thoughts, chat sessions, messages and user settings.
- RLS ownership policies for all diary data.

## Known limitations

- Chat sessions, messages and settings are schema-ready but are not yet wired into the current UI.
- The frontend stores the current session in browser local storage.
- CORS remains open for compatibility with the current MVP deployment and should be restricted after production origins are finalized.
- There is no automated test suite yet.
- Applying the migration to production is a separate reviewed deployment step.

No new AI provider or model is introduced by this release.
