// Google sign-in with Google Identity Services (token model). The page gets a short-lived access token for
// the Sheets API and the account's email, and never sees a password or a long-lived refresh token.

import { config } from "./config";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SCOPES = `openid email ${SHEETS_SCOPE}`;
const STORAGE_KEY = "job-tracker.session";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}
interface GoogleOAuth2 {
  initTokenClient(c: {
    client_id: string;
    scope: string;
    hd?: string;
    login_hint?: string;
    include_granted_scopes?: boolean;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

export interface Session {
  accessToken: string;
  expiresAt: number; // ms since epoch
  email: string;
}

let gisLoading: Promise<GoogleOAuth2> | null = null;

function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error("Google sign-in didn't load.")));
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn't reach Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** Start loading Google's script early so the sign-in popup opens without delay. */
export const preloadGoogle = () => void loadGis().catch(() => {});

async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Couldn't read your Google account's email.");
  const info = (await res.json()) as { email?: string; email_verified?: boolean };
  if (!info.email || info.email_verified === false) throw new Error("Your Google account's email isn't verified.");
  return info.email.toLowerCase();
}

/** Opens Google's sign-in popup. Must be called from a click so browsers allow the popup. */
export async function signIn(loginHint?: string): Promise<Session> {
  const oauth2 = await loadGis();
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES,
      hd: config.workspaceDomain,
      login_hint: loginHint,
      include_granted_scopes: true,
      callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "Sign-in was closed before it finished." : e.message || "Sign-in failed.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
  if (!oauth2.hasGrantedAllScopes(response, SHEETS_SCOPE)) {
    throw new Error("The tracker needs permission to see and edit your Google Sheets. Sign in again and allow it.");
  }
  const session: Session = {
    accessToken: response.access_token,
    expiresAt: Date.now() + response.expires_in * 1000,
    email: await fetchEmail(response.access_token),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

/** The session from this browser tab, if its token is still good for at least a minute. */
export function restoreSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    return s && s.expiresAt - Date.now() > 60_000 ? s : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function signOut(session: Session | null) {
  clearSession();
  if (!session) return;
  try {
    (await loadGis()).revoke(session.accessToken);
  } catch {
    // The token expires on its own within the hour.
  }
}

export const isAllowed = (email: string) => config.allowedEmails.includes(email.toLowerCase());
