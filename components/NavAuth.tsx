"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { beginSignIn, serverUserName, signOut, ssojetConfigured, subscribeUser, userName } from "./auth/ssojet";

// Optional "Sign in with SSOJet". Nothing in Interviewlenz requires an
// account: practice, reports and history all work signed out.
export function NavAuth() {
  // sessionStorage is client-only; the server snapshot is "signed out".
  const name = useSyncExternalStore(subscribeUser, userName, serverUserName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function signIn() {
    setError(null);
    if (!ssojetConfigured()) {
      dialog.current?.showModal();
      return;
    }
    setBusy(true);
    try {
      await beginSignIn(); // navigates away on success
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
          onClick={signOut}
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
        disabled={busy}
        data-testid="nav-auth-signin"
        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span className="hidden sm:inline">{busy ? "Redirecting…" : "Sign in with SSOJet"}</span>
        <span className="sm:hidden">Sign in</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="ssojet-title"
        data-testid="nav-auth-dialog"
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-border bg-card p-6 text-foreground shadow-lift backdrop:bg-black/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id="ssojet-title" className="text-lg font-semibold">
          Sign in with SSOJet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {error ?? "Single sign-on isn't set up in this build."} An account is optional: you can start an interview, get your
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
