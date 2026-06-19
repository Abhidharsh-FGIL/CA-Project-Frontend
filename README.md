# Evaluation Portal — Standalone

A surgical extract of the **Evaluation Hub** and **Test Portal (TakeAssessment)** modules from the GenVerse / Remix-of-Genverse-Eduverse project, packaged as a standalone Vite + React app.

## What's in this build

| Route                                  | Component                                  | Source path                                              |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `/`                                    | Landing (custom)                           | `src/App.tsx`                                            |
| `/org/evaluation`                      | Evaluation Hub                             | `src/pages/org/EvaluationHubPage.tsx`                    |
| `/org/evaluation/paper/:paperId`       | Paper Detail                               | `src/components/evaluation/EvalPaperDetailPage.tsx`      |
| `/take-assessment`                     | Test Portal (token-based candidate view)   | `src/pages/TakeAssessmentPage.tsx`                       |

## What's been stripped vs. the source project

- **Auth & role guards** removed. `AuthContext`, `WorkspaceContext`, `SubscriptionContext` are replaced with minimal stubs that hand out a fixed demo user / `demo-org` workspace with `hasEvaluation: true` and `canAccessFeature: () => true`. No login flow, no Google OAuth, no token refresh on the UI level.
- **Sidebar / Topbar** chrome removed. `GenVerseShell` is simplified to a minimal header so we don't drag in the rest of the app's navigation, points display, workspace switcher, etc.
- **Backend URL** still configurable. Edit `public/config.js` or set `VITE_API_BASE_URL` to point at your FastAPI backend; `lib/api.ts` is unchanged from the source and reads a JWT from `localStorage.access_token` if you want authenticated requests to succeed.

## Running

```bash
npm install
npm run dev        # http://localhost:4201
npm run build      # production build
npm run typecheck  # tsc --noEmit (a handful of pre-existing source-codebase errors are expected)
```

## Backend

This frontend talks to the same FastAPI backend (`/api/v1/evaluation/*`) used by the original project — it isn't included here. To exercise data flows:

1. Run the backend in `Remix-of-Genverse-backend/` of the parent project.
2. Set `window.__APP_CONFIG__.API_BASE_URL` in `public/config.js` to the backend URL (default `http://127.0.0.1:8000`).
3. Put a valid `access_token` in `localStorage` (the stripped auth flow does not obtain one for you).
