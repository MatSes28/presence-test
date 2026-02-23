# SSO / OIDC integration (world-class university)

For institution-wide deployment, many universities use **Single Sign-On (SSO)** with an identity provider (IdP) such as **Keycloak**, **Google Workspace**, **Microsoft Entra ID**, or **Shibboleth**. This document describes how to integrate CLIRDEC:PRESENCE with an OIDC/OAuth2 IdP.

---

## Current state

- **Local login:** `POST /api/auth/login` with email + password; JWT and HTTP-only cookie.
- **SSO:** Implemented. When `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_REDIRECT_URI` are set:
  - `GET /api/auth/config` returns `{ ssoEnabled: true }` (for login page).
  - `GET /api/auth/oidc` redirects to IdP; `GET /api/auth/oidc/callback` exchanges code, finds or creates user (`OIDC_CREATE_USER=1` to allow auto-create), sets session cookie, redirects to `/`.
  - Login page shows "Sign in with SSO" when SSO is enabled.

---

## Recommended approach

1. **Use an IdP** that supports OIDC (e.g. Keycloak, Google, Entra ID).
2. **Register a client** for CLIRDEC (redirect URI: `https://your-app.example.com/api/auth/oidc/callback`).
3. **Backend:** Add routes, for example:
   - `GET /api/auth/oidc` — redirects to IdP authorization URL (`authorization_endpoint`).
   - `GET /api/auth/oidc/callback` — receives `code`, exchanges for tokens, gets user info from IdP, then **find or create user** in `users` by email and **issue your app’s JWT** (and set HTTP-only cookie) so the rest of the app stays unchanged.
4. **Frontend:** Add a “Sign in with SSO” button that redirects to `GET /api/auth/oidc` (or your IdP login URL).
5. **User provisioning:** Decide policy: only allow existing users (match by email) or auto-create faculty/admin from IdP claims (e.g. email, name, role from groups).

---

## Environment (when you implement)

Typical env vars for OIDC:

- `OIDC_ISSUER` — e.g. `https://idp.university.edu/realms/main`
- `OIDC_CLIENT_ID` — client id from IdP
- `OIDC_CLIENT_SECRET` — client secret (or use PKCE for public clients)
- `OIDC_REDIRECT_URI` — e.g. `https://your-app.example.com/api/auth/oidc/callback`
- `OIDC_SCOPES` — e.g. `openid profile email`

Discovery: `GET {OIDC_ISSUER}/.well-known/openid-configuration` for `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`.

---

## Summary

SSO is **not** implemented in the current codebase. Use this as a guide when you add OIDC routes and a “Sign in with SSO” flow; keep issuing the same JWT/cookie so the rest of the app (sessions, attendance, reports) is unchanged.
