"use client";

import { useState } from "react";
import type { Report } from "@/lib/contract";
import { ReadAloud } from "../ReadAloud";

export function ReportExtras({ report, band }: { report: Report; band: string }) {
  const [verification, setVerification] = useState("");
  const proof = report.skillProof;
  async function verify() {
    if (!proof) return;
    setVerification("Checking Devnet…");
    try {
      const params = new URLSearchParams({ signature: proof.signature, digest: proof.digest });
      const res = await fetch(`/api/solana-verify?${params}`, { cache: "no-store" });
      const { status } = await res.json();
      const messages: Record<string, string> = {
        confirmed: "Confirmed on Devnet. The issuer and report digest match.",
        invalid: "This transaction does not verify this report.",
        pending: "No confirmed transaction found yet. Check again shortly.",
      };
      setVerification(messages[status] ?? "Verification is unavailable. Try again.");
    } catch {
      setVerification("Verification is unavailable. Try again.");
    }
  }
  return <div className="flex flex-col items-start gap-2">
    <ReadAloud text={`Round assessment: ${band}. Next step: ${report.nextStep}`} label="Audio Debrief" />
    {proof && <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
      <p className="font-semibold">Proof of Skill · Solana Devnet</p>
      <a className="underline" href={proof.explorerUrl} target="_blank" rel="noreferrer">View transaction on Solana Explorer</a>
      <button type="button" className="ml-3 underline" disabled={verification === "Checking Devnet…"} onClick={verify}>Verify credential</button>
      <p role="status">{verification || "Submitted for confirmation."}</p>
    </div>}
    {report.skillProofUnavailable && <p className="text-xs text-muted-foreground">Devnet credential unavailable for this report.</p>}
  </div>;
}
