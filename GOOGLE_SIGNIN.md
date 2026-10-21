# Sign in with Google — setup and backend contract

The login and sign-up pages show Google's own button when a client ID is configured. With no client ID they
look exactly as before.

## 1. The key — where it goes

There is **one setting in the frontend: the OAuth client ID.**

```
# .env  (or .env.local) — not committed
VITE_GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
```

- It is read in `src/config/google.ts`. Restart `npm run dev` after changing it, and rebuild for production
  (Vite bakes `VITE_*` values in at build time).
- The client ID is **public** (anyone can read it in the page). It is in the environment so each deployment
  can use its own, not to hide it.
- The client **secret** is not needed in the frontend and must never be put in it.

### Getting the client ID

1. Google Cloud console → pick or create a project → **APIs & Services → OAuth consent screen**. Fill in the app
   name, support email and the developer contact; add the scopes `openid`, `email`, `profile`.
2. **Credentials → Create credentials → OAuth client ID → Application type: Web application.**
3. **Authorized JavaScript origins** — every address the app is served from, exactly:
   - `http://localhost:5173` (local development)
   - `https://mygovexams.com` (production)
   No redirect URI is needed: the button runs in a popup.
4. Copy the client ID into `VITE_GOOGLE_CLIENT_ID`. Give the **same client ID** to the backend (below).

## 2. What the backend has to provide

One endpoint, public (no bearer token):

```
POST /api/v1/user/auth/google
{ "id_token": "<Google ID token>", "profile": { ... }   // profile is optional }
```

The backend must **verify the ID token with Google** (signature, `aud` equal to this client ID, `iss`, expiry, and
`email_verified` true) and take the email and name from the verified token — never from the request body.
Libraries: `google-auth` (`google.oauth2.id_token.verify_oauth2_token`). It needs the client ID only, no secret.

| Case | Answer |
| --- | --- |
| An account with that email exists | `200 { access_token, refresh_token, token_type }` — same as `/user/auth/login` |
| No account, no `profile` sent | `200 { "needs_profile": true, "email": "...", "name": "..." }` — nothing is created |
| No account, `profile` sent | create the account (email already verified: no OTP), then the same tokens |
| Token invalid / expired / wrong audience | `401` with the usual `{ success:false, error_code, message }` |
| Account suspended / locked / deactivated | `403`, the same messages the login uses |

`profile` carries the details the sign-up form collects, with the same names `register` uses:
`full_name`, `mobile_number`, `date_of_birth`, `gender`, `medium`, `preferred_exam`, and the legacy
`student_class`, `section`, `roll_no`, `school_name`, `class_teacher`, `academic_year` (blank strings).

Notes for the backend:
- Match accounts by the verified email (case-insensitive). An existing password-less or OTP-only account just
  signs in; there is nothing to link.
- A Google sign-up has no password. `register` no longer asks for one either.

## 3. How the pages behave

- **Login page** — "Sign in with Google" under the form. Known account → signed in, dashboard. New account →
  sent to the sign-up page with the Google name and email already filled in.
- **Sign-up page** — "Sign up with Google" on top. If the account exists it signs in; otherwise the name and email
  are filled (email locked), the person adds phone, date of birth, gender, language paper and exam, and submits.
  No OTP step for a Google sign-up. "Use a different account" clears it.

Code: `src/config/google.ts`, `src/lib/google-identity.ts`, `src/pages/user/auth/GoogleButton.tsx`,
`googleAuth` in `src/lib/userAuthApi.ts`, `signInWithGoogle` in `src/contexts/UserPortalContext.tsx`.
