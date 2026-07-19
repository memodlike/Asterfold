# Optional cloud sync setup

Asterfold is complete in local-only mode. Cloud transport is opt-in and never replaces IndexedDB as the immediate source of truth.

## Configure Supabase

1. Create a Supabase project and apply `docs/optional-sync/0001_asterfold_sync.sql` with the Supabase CLI.
2. Enable Google under Authentication → Providers.
3. Add the Chrome redirect URL shown by `chrome.identity.getRedirectURL("supabase-auth")` to the Supabase and Google OAuth allowlists. The unpacked extension ID must be stable before this step.
4. Copy `docs/optional-sync/env.example` to `.env.local` and set:

   ```text
   WXT_ENABLE_CLOUD_SYNC=true
   WXT_SUPABASE_URL=https://PROJECT.supabase.co
   WXT_SUPABASE_ANON_KEY=PUBLIC_PUBLISHABLE_KEY
   ```

5. Rebuild. The manifest adds only that exact HTTPS origin. Do not use a service-role key, OAuth client secret, database password, or wildcard host permission.

## Protocol

- Authentication uses Google OAuth with PKCE through `chrome.identity.launchWebAuthFlow`.
- Local writes remain immediate. Enabled accounts queue idempotent operations in Dexie.
- `apply_sync_operation` records operation receipts, applies monotonic entity versions, and assigns a server cursor.
- Pulls are ordered by server cursor. Payloads pass Zod validation before reaching IndexedDB.
- RLS forces every select/insert/update/delete to `auth.uid() = user_id`.
- Failed operations retain exponential retry metadata; sync errors never make the workspace read-only.

The checked-in local build intentionally has no endpoint or credential, so live OAuth/two-device validation is not part of the default release.
