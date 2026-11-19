// Settings come from build-time variables (GitHub repository variables in CI, .env.local in development).
// None of them are secrets: a Google OAuth client ID and a spreadsheet ID are public by design, and Google
// enforces who can sign in (an Internal Workspace app) and who can open the sheet (its sharing settings).

const list = (value: string | undefined, fallback: string) =>
  (value || fallback)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const config = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  sheetId: import.meta.env.VITE_SHEET_ID ?? "",
  /** Only these Google accounts may use the tracker. */
  allowedEmails: list(import.meta.env.VITE_ALLOWED_EMAILS, "hello@alohateresa.com"),
  /** Hint for Google's account chooser. */
  workspaceDomain: "alohateresa.com",
};

export const sheetUrl = () => `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`;
