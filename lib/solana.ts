// Server-only. Issue a receipt from the normalized report, never a client-supplied grade.
import { createHash } from "node:crypto";
import type { Report, RoundType } from "./contract";
import { scoreRound } from "./score";

const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DEVNET = "https://api.devnet.solana.com";
const prefix = "interviewlenz:skill:v1:";

async function connection() {
  const web3 = await import("@solana/web3.js");
  const rpc = new web3.Connection(DEVNET, {
    commitment: "confirmed", disableRetryOnRateLimit: true,
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(3500) }),
  });
  return { web3, rpc };
}

export async function attachSkillProof(report: Report, round: RoundType): Promise<Report> {
  const band = scoreRound(round, report.findings).band;
  if (band !== "solid" && band !== "strong") return report;
  const key = process.env.SOLANA_DEVNET_SECRET_KEY;
  if (!key) return report;
  try {
    const { web3, rpc } = await connection();
    const issuer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
    const digest = createHash("sha256").update(JSON.stringify([report.attemptId, band, report.createdAt])).digest("hex");
    const { blockhash } = await rpc.getLatestBlockhash();
    const tx = new web3.Transaction({ recentBlockhash: blockhash, feePayer: issuer.publicKey });
    tx.add(new web3.TransactionInstruction({
      programId: new web3.PublicKey(MEMO), keys: [{ pubkey: issuer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(prefix + digest),
    }));
    tx.sign(issuer);
    const signature = await rpc.sendRawTransaction(tx.serialize(), { maxRetries: 2 });
    return { ...report, skillProof: { signature, digest, explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet` } };
  } catch {
    return { ...report, skillProofUnavailable: true };
  }
}

export async function verifySkillProof(signature: string, digest: string) {
  const key = process.env.SOLANA_DEVNET_SECRET_KEY;
  if (!key) return "unavailable";
  const { web3, rpc } = await connection();
  const issuer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key))).publicKey;
  const tx = await rpc.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!tx) return "pending";
  if (!tx.meta || tx.meta.err) return "invalid";
  const message = tx.transaction.message;
  const payer = message.accountKeys[0];
  const matches = message.instructions.some(ix => ix.programId.toBase58() === MEMO && "parsed" in ix && ix.parsed === prefix + digest);
  return payer?.signer && payer.pubkey.equals(issuer) && matches ? "confirmed" : "invalid";
}
