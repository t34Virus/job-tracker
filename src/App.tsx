import { useCallback, useEffect, useMemo, useState } from "react";
import { config } from "./config";
import { clearSession, isAllowed, preloadGoogle, restoreSession, signIn, signOut, type Session } from "./google";
import { SheetsSource, type DataSource } from "./sheets";
import { NotAllowed, SetupNeeded, SignIn } from "./Screens";
import { Tracker } from "./Tracker";

// npm run dev, then /?demo: made-up data, no sign-in. Never part of a production build.
const demoSource: Promise<DataSource> | null =
  import.meta.env.DEV && new URLSearchParams(location.search).has("demo") ? import("./demo").then((m) => new m.DemoSource()) : null;

function Demo() {
  const [source, setSource] = useState<DataSource | null>(null);
  useEffect(() => {
    void demoSource?.then(setSource);
  }, []);
  return source ? <Tracker source={source} email="demo@example.com" onSignOut={() => location.assign(location.pathname)} onAuthExpired={() => {}} demo /> : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => restoreSession());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session) preloadGoogle();
  }, [session]);

  const source = useMemo(() => (session ? new SheetsSource(session.accessToken) : null), [session]);

  const expired = useCallback(() => {
    clearSession();
    setSession(null);
    setNotice("Your sign-in expired after an hour. Sign in again to keep going.");
  }, []);

  if (demoSource) return <Demo />;
  if (!config.clientId || !config.sheetId) return <SetupNeeded />;

  if (!session) {
    return (
      <SignIn
        notice={notice}
        onSignIn={async () => {
          setSession(await signIn(config.allowedEmails[0]));
          setNotice("");
        }}
      />
    );
  }

  const leave = () => {
    void signOut(session);
    setSession(null);
  };

  if (!isAllowed(session.email)) return <NotAllowed email={session.email} onSignOut={leave} />;
  return <Tracker source={source!} email={session.email} onSignOut={leave} onAuthExpired={expired} />;
}
