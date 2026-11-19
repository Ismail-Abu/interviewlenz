"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { getProviders, SessionProvider, signIn as startSignIn, signOut, useSession } from "next-auth/react";
import { activateTheme, deactivateTheme, setTheme, useTheme } from "./theme";

const buttonStyle = "inline-flex h-9 max-w-40 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const dialogStyle = "m-auto w-[min(92vw,26rem)] rounded-2xl border border-border bg-card p-6 text-foreground shadow-lift backdrop:bg-black/40";
const nameKey = "interviewlenz:local-display-name";

function readLocalName() {
  try { return localStorage.getItem(nameKey) ?? ""; } catch { return ""; }
}

function subscribeLocalName(refresh: () => void) {
  window.addEventListener("storage", refresh);
  window.addEventListener("interviewlenz-name-changed", refresh);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener("interviewlenz-name-changed", refresh);
  };
}

function RememberMe() {
  const name = useSyncExternalStore(subscribeLocalName, readLocalName, () => "");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  function save(value: string) {
    try {
      if (value) localStorage.setItem(nameKey, value);
      else localStorage.removeItem(nameKey);
      window.dispatchEvent(new Event("interviewlenz-name-changed"));
      dialog.current?.close();
    } catch {
      setError("Your browser blocked this change. You can still practice.");
    }
  }

  return (
    <>
      <button type="button" data-testid="nav-auth-signin" className={buttonStyle}
        onClick={() => { setDraft(name); setError(""); dialog.current?.showModal(); }}>
        <span className="truncate">{name ? `Hi, ${name}` : "Remember me"}</span>
      </button>
      <dialog ref={dialog} aria-labelledby="remember-title" aria-describedby="remember-help"
        data-testid="nav-auth-dialog" className={dialogStyle}>
        <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) save(draft.trim()); }}>
          <h2 id="remember-title" className="text-lg font-semibold">Remember me on this device</h2>
          <p id="remember-help" className="mt-2 text-sm text-muted-foreground">
            Save your name in this browser for your next visit. You can practice without an account.
          </p>
          <label htmlFor="remember-name" className="mt-4 block text-sm font-medium">Display name</label>
          <input id="remember-name" value={draft} onChange={e => setDraft(e.target.value)}
            maxLength={60} autoComplete="given-name" required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />
          {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 text-sm">
            {name && <button type="button" className="mr-auto underline" onClick={() => save("")}>Forget me</button>}
            <button type="button" data-testid="nav-auth-dialog-close" onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" disabled={!draft.trim()}
              className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">Save name</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function NavAuth() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    getProviders().then((providers) => { if (active) setConfigured(Boolean(providers?.ssojet)); })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, []);
  // Theme choice is a signed-in feature; without SSOJet nobody is signed in.
  useEffect(() => { if (configured === false) deactivateTheme(); }, [configured]);
  if (configured === null) return null;
  return configured ? <SessionProvider><SignIn /></SessionProvider> : <RememberMe />;
}

function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {dark ? (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function SignIn() {
  const { data: session, status } = useSession();
  const name = session?.user?.name;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  // Signed in: show the saved theme. Signed out or session expired: back to light.
  // Layout effect so it lands before paint (also re-applies after React's dev remount).
  useLayoutEffect(() => {
    if (status === "authenticated") activateTheme();
    else if (status === "unauthenticated") deactivateTheme();
  }, [status]);

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      await startSignIn("ssojet", { callbackUrl: "/" });
    } catch {
      setBusy(false);
      setError("SSOJet sign-in is unavailable right now.");
      dialog.current?.showModal();
    }
  }

  if (name) {
    return (
      <span className="flex items-center gap-2 text-xs" data-testid="nav-auth-user">
        <span className="hidden max-w-36 truncate font-medium text-foreground sm:inline">{name}</span>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => { deactivateTheme(); void signOut({ callbackUrl: "/" }); }}
          className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={busy || status === "loading"}
        data-testid="nav-auth-signin"
        className={buttonStyle}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>{busy ? "Redirecting…" : "Sign in"}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="ssojet-title"
        data-testid="nav-auth-dialog"
        className={dialogStyle}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id="ssojet-title" className="text-lg font-semibold">
          Sign in with SSOJet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {error} An account is optional: you can start an interview, get your
          report and see your history without signing in.
        </p>
        <form method="dialog" className="mt-5 flex justify-end">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" data-testid="nav-auth-dialog-close">
            Continue without signing in
          </button>
        </form>
      </dialog>
    </>
  );
}
