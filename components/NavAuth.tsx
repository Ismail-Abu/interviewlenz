"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getProviders, SessionProvider, signIn as startSignIn, signOut, useSession } from "next-auth/react";

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
  if (configured === null) return null;
  return configured ? <SessionProvider><SignIn /></SessionProvider> : <RememberMe />;
}

function SignIn() {
  const { data: session, status } = useSession();
  const name = session?.user?.name;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

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
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
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
