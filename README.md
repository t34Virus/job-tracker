# Job Search Tracker

A private web view of my job search: applications, outreach and saved jobs.

**Live:** https://t34virus.github.io/job-tracker/

## How it works

- The data lives in a Google Sheet, not in this repo or on GitHub. The site is a static page (React, TypeScript, Vite) that reads and writes the sheet with the Google Sheets API.
- Sign-in is Google's own (Google Identity Services). The page gets a one-hour access token, never a password.
- Only `hello@alohateresa.com` can use it, enforced three ways:
  1. The Google sign-in app is **Internal** to the alohateresa.com Workspace, so outside accounts can't sign in at all.
  2. The page checks the signed-in email against `VITE_ALLOWED_EMAILS`.
  3. The sheet itself is shared only with my accounts, so Google refuses anyone else's requests.
- Edits made here and in Google Sheets stay in sync, because they're the same file.

## Setup (one time)

### 1. Google sign-in client

Signed in to [Google Cloud Console](https://console.cloud.google.com/) as `hello@alohateresa.com`:

1. Create a project (for example "Job Tracker") under the **alohateresa.com** organization.
2. **APIs & Services > Library:** enable the **Google Sheets API**.
3. **Google Auth Platform > Branding** (the OAuth consent screen): app name "Job Search Tracker", support email `hello@alohateresa.com`. **Audience:** choose **Internal**.
4. **Google Auth Platform > Clients > Create client:** type **Web application**.
   - Authorized JavaScript origins: `https://t34virus.github.io` and, for local development, `http://127.0.0.1:5179`.
   - No redirect URIs are needed.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It isn't a secret; there is no client secret in this app.

### 2. Repository variables

GitHub > this repo > Settings > Secrets and variables > Actions > **Variables**:

| Name | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | the client ID from step 1 |
| `VITE_SHEET_ID` | the ID in the sheet's URL, between `/d/` and `/edit` |
| `VITE_ALLOWED_EMAILS` | optional; defaults to `hello@alohateresa.com` |

Then run the **Deploy to GitHub Pages** workflow (Actions tab), or push to `main`.

### 3. Sheet access

Share the Google Sheet with `hello@alohateresa.com` as an **Editor**.

## Sheet format

Three tabs, each with headers in row 1. Rows are matched by header name, so columns can be reordered.

- **Applications:** Date applied, Company, Role, Job ID, Location and work style, Posted pay, Applied on, Job link, Resume sent, Also sent, Status, Next step, Notes
- **Outreach:** Date, Person, Their role, Company, Platform, Profile link, Related job, What I sent, Status, Next step
- **Saved, not applied:** Company, Role, Job ID, Location and work style, Posted pay, Job link, Materials ready, Why not applied yet

## Development

```sh
npm install
cp .env.example .env.local   # then fill in the two IDs
npm run dev -- --host 127.0.0.1 --port 5179
```

Open http://127.0.0.1:5179/job-tracker/?demo to work on the layout with made-up data and no sign-in. Demo mode exists only in development builds.

`npm run lint` and `npm run build` must pass before a push; the deploy workflow runs both.
