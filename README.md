# Defacto ERP — Mobile

React Native (Expo) client for the Defacto inward/processing/dispatch system.
It talks to the same API as the web client in `../client` and enforces the same
permission model, so a user sees exactly the screens their role allows.

## Running it

```bash
npm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at your API
npx expo start            # then press i / a, or scan the QR code
```

The API must list the app's origin in `CORS_ORIGINS` and be served over https in
production, so the `Secure; SameSite=None` refresh cookie is accepted.

## How it is put together

```
src/
  api/            HTTP layer, ported from the web client (axios + silent refresh)
  app/            Expo Router file routes — the screens
  components/ui/  The design system: Text, Button, Card, Sheet, Select, …
  components/     Composites shared by screens (RecordCard, ListBody, NavMenu)
  features/
    masters/      Config-driven CRUD: one registry drives all 15 master screens
    operations/   Domain logic — stock maths, bill maths, allocation picking
  hooks/          usePermissions, useSyncedState
  lib/            Formatting, session storage, env, ObjectId
  store/          Zustand auth store
  theme/          Design tokens and the ThemeProvider (light + dark)
```

### Session handling

The access token is kept in the OS keystore via `expo-secure-store` rather than
in memory only (as the web client does) — a warehouse phone that signs you out
on every cold start is unusable. On launch the stored token is restored
optimistically, then verified against `/auth/me`; if it has expired, the axios
interceptor performs a single coordinated refresh and replays every queued
request.

### Permissions

`src/config/navigation.ts` is the single source of truth: menus filter against
it, and each screen re-checks with `useModulePermissions`. Blocks that query a
module are only mounted when the role permits reading it, so the app never fires
a request it knows will 403.

### Adding a master

Add an entry to `MASTER_CONFIGS` in `src/features/masters/registry.ts`. The list
screen, the form, validation, search and the delete guard all come from it — no
new screen files.

## Checks

```bash
npx tsc --noEmit    # types
npx expo lint       # lint + React Compiler rules
```
