"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { completeSignIn } from "@/components/auth/ssojet";

// SSOJet redirects here after sign-in. On success, return home.
export default function SsojetCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    completeSignIn(new URLSearchParams(window.location.search))
      .then(() => {
        if (!cancelled) window.location.replace("/");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error && e.message.length < 120 ? e.message : "Sign-in didn't complete. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <div className="max-w-sm text-center" role="status">
        <p className="text-sm text-muted-foreground">{error ?? "Finishing sign-in…"}</p>
        {error && (
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to Interviewlenz
          </Link>
        )}
      </div>
    </main>
  );
}
