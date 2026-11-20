# Admin-editable text in the mobile app — what the app has to do

The admin portal has an **App content** screen (Admin Settings → App content). An admin can reword any text the app has,
without a release. The web portal already works this way (see `src/content/` in the web repo — `store.ts` is the reference
for the behaviour below). This note is what the **mobile team** must do so the screen has something to edit and the edits
reach students: the **app** reads the changes, and the **release process** uploads the list of texts.

## What we need from the mobile team

**One file: `app-content-catalogue.json`** — a list of every user-visible text in the app, in this format (a sample is in
`app-content-catalogue.sample.json`):

```json
{
  "entries": [
    { "key": "auth.login.title", "text": "Welcome Back", "group": "Sign in, register & onboarding" },
    { "key": "home.greeting", "text": "Hello, {name}!", "group": "Home" }
  ]
}
```

| Field | Rule |
|---|---|
| `key` | The app's own text key. Unique, stable, never renamed after release. |
| `text` | The text exactly as the app shows it today (the built-in wording), up to 4,000 characters. Keep `{name}`-style placeholders as they are. |
| `group` | The screen or area the admin will see it under ("Login", "Home", "Profile"), up to 80 characters. |

* **Every** text goes in, every time — the file replaces the whole list. Up to 5,000 entries.
* Generate it from the app's text table with a script; do not type it by hand.
* **When:** the first time (before any admin can edit app text), and again with every release that adds, removes or
  rewords a built-in text.
* **Where it goes:** hand the file to the admin team, who upload it under Admin Settings → App content → Upload text list.
  (Or the app team uploads it themselves in the release step with an admin account — see below. Either way, never from the app.)
* **Check:** the admin screen stops with a list of problems if the file has a missing key, a repeated key, a text over 4,000
  characters or a missing group, so fix those at the source and send it again.

## How the pieces fit

```
Release step (build script / app team, with an admin login)
  └─ PUT /admin/app-content/catalogue  ──────────────►  Backend  ◄──  Admin portal: App content screen
                                                         stores         lists the catalogue, admin edits,
App (every text has a key + built-in wording in code)    the list      saves { key: new text }
  └─ GET /public/app-content  (no login)  ◄──────────   + only the
       shows the changed text if there is one,           changed texts
       else its built-in text
```

**The app never uploads the catalogue.** That call needs an admin token, and an admin token must never be shipped inside
the app. The upload belongs to the release process.

The admin screen uses these (already built on the backend):

| Call | Body |
|---|---|
| `GET /api/v1/admin/app-content/catalogue` | `{ "entries": [{ "key", "text", "group" }] }` — every text the app has, with its built-in wording |
| `GET /api/v1/admin/app-content` | `{ "content": { "<key>": "<text>" } }` — only the texts that were changed |
| `PUT /api/v1/admin/app-content` | `{ "content": { … } }` — the whole map of changed texts; 422 on a bad key, a value over 4,000 characters, or more than 5,000 keys |

### The two calls for the mobile side (confirmed with the backend)

**Upload the text list — release step only, never from the app**

```
PUT /api/v1/admin/app-content/catalogue
Authorization: Bearer <admin token>        (the admin portal's token; without it → 403)
```
```json
{ "entries": [ { "key": "auth.login.title", "text": "Welcome Back", "group": "Sign in, register & onboarding" } ] }
```
* Replaces the whole list each time — always send every text, not just the new ones.
* Limits: 5,000 entries, unique keys, `text` up to 4,000 characters, `group` up to 80.
* Who calls it: a build/CI step, or a person on the app team with an admin account, **once per release**.

**Read the changes — from the app**

```
GET /api/v1/public/app-content             (no auth — splash and login can use it)
```
```json
{ "content": { "auth.login.title": "Welcome!" } }
```
* Only the texts an admin changed; `{ "content": {} }` when nothing is changed.
* Sends `Cache-Control: public, max-age=300`, so a change can take up to **5 minutes** to appear.

## What the app must do

### 1. Give every user-visible text a key, with the built-in wording in code
- Keys are dotted, lower-case, stable: `login.title`, `home.empty.tests`, `profile.logout.confirm`. Keep to `[a-z0-9._-]`,
  up to 120 characters.
- **Never rename or reuse a key once shipped** — an admin's change is stored against the key. Renaming orphans it.
- Group by screen: the catalogue's `group` is what the admin sees as a section ("Login", "Home", "Profile").
- The built-in text stays in the app, so the app works offline, on first launch, and with no server setting.

### 2. Keep the catalogue in step with the code (release step)
- Generate the list from the app's own text table (key, built-in text, group) rather than keeping a second copy by hand —
  a build script that walks the table and calls the upload is the safest.
- Upload on every release that adds a text or changes a built-in wording, so the admin sees the current wording as the
  placeholder. Because each upload replaces the list, a key the app no longer has drops out automatically (an admin's saved
  change for it is then ignored by the app).
- Group names are what the admin sees as sections ("Sign in, register & onboarding"); keep them consistent between releases.

### 3. Read and apply the admin's changes
- Fetch `GET /api/v1/public/app-content` at launch (and on resume after a few minutes — the server caches for 5). Apply `content[key]` if it is a non-empty string, else use the
  built-in text.
- **Cache the last answer on the device** and use it immediately on the next launch, then refresh in the background —
  otherwise users see the old wording for a moment on every start. If the fetch fails, keep the cache; if there is no
  cache, use the built-in text. Never block a screen on this call.
- Texts are **plain text**: do not render them as HTML or markdown. Keep line breaks.

### 4. Placeholders
- Dynamic parts are written `{name}` (for example `Welcome back, {name}!`, `{count} tests left`). The app fills them in.
- The admin screen warns when an edit removes a placeholder the built-in text has, but still lets them save — so the app
  must **never crash or show a blank** if a placeholder is missing, and should leave an unknown `{word}` as typed.
- Use `{name}`-style placeholders only (letters, digits, underscore), not positional (`%1$s`) or ICU syntax, so the admin
  can read and keep them.

### 5. Things to keep in code (not editable)
- Pluralisation ("1 test" / "2 tests") — either two keys (`tests.one`, `tests.other`) or leave it in code.
- Error messages from the server, data (names, prices), and legal pages.
- Anything that is not a sentence a business owner would reword.

## Checklist before release
- [ ] Every user-visible string goes through the key lookup, with its built-in text as the fallback.
- [ ] Airplane mode on first launch → app shows built-in text, no spinner, no crash.
- [ ] Change a text in the admin → it shows after the next launch/refresh; change it back → built-in text returns.
- [ ] Remove a `{placeholder}` in the admin → the screen still renders sensibly.
- [ ] Cached text is used on the next cold start before the network call finishes.
- [ ] Catalogue uploaded in the release step (not from the app): the admin's App content screen lists the new keys under the right group.
- [ ] No admin token anywhere in the app or its build config.
- [ ] After saving a change in the admin, allow up to 5 minutes (server cache) before expecting it in the app.
