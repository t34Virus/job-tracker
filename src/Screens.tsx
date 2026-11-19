import { useState, type ReactNode } from "react";
import { config } from "./config";

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

function Card({ children }: { children: ReactNode }) {
  return (
    <main className="center">
      <div className="panel">
        <p className="brand" aria-hidden="true">🌺</p>
        {children}
      </div>
    </main>
  );
}

export function SetupNeeded() {
  const missing = [!config.clientId && "Google sign-in client ID (VITE_GOOGLE_CLIENT_ID)", !config.sheetId && "Sheet ID (VITE_SHEET_ID)"].filter(Boolean);
  return (
    <Card>
      <h1>Almost ready</h1>
      <p className="muted">The tracker is live, but it still needs its Google settings before anyone can sign in:</p>
      <ul className="missing">
        {missing.map((m) => (
          <li key={String(m)}>{m}</li>
        ))}
      </ul>
      <p className="muted small">Add them as repository variables on GitHub and run the deploy again. The README has the steps.</p>
    </Card>
  );
}

export function SignIn({ onSignIn, notice }: { onSignIn: () => Promise<void>; notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await onSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h1>Job Search Tracker</h1>
      <p className="muted">Applications, outreach and saved jobs, straight from your Google Sheet.</p>
      {notice && <p className="notice">{notice}</p>}
      <button className="google" onClick={() => void go()} disabled={busy}>
        <GoogleG />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">Private. Only {config.allowedEmails.join(", ")} can sign in.</p>
    </Card>
  );
}

export function NotAllowed({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <Card>
      <h1>This tracker is private</h1>
      <p className="muted">
        You're signed in as <strong>{email}</strong>, which doesn't have access.
      </p>
      <button className="button" onClick={onSignOut}>
        Sign out and switch accounts
      </button>
    </Card>
  );
}
