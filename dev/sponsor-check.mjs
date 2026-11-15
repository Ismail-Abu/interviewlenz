// Offline provider checks. Transactions are signed locally and captured before broadcast.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Connection, Keypair, Transaction } from "@solana/web3.js";

const dir = await mkdtemp(join(process.cwd(), "node_modules", ".sponsor-check-"));
const require = createRequire(import.meta.url);
async function load(entry) {
  const file = join(dir, entry.replaceAll("/", "-") + ".cjs");
  const result = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", target: "node22", write: false, external: ["@solana/web3.js"] });
  await writeFile(file, result.outputFiles[0].contents);
  return require(file);
}

try {
  const { POST } = await load("app/api/elevenlabs/route.ts");
  const { attachSkillProof } = await load("lib/solana.ts");
  const { GET } = await load("app/api/solana-verify/route.ts");
  const speak = (text) => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" } }));
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal((await speak(" ")).status, 400);
  assert.equal((await speak("x".repeat(2501))).status, 400);
  assert.deepEqual(await (await speak("Hello")).json(), { playback: "browser" });
  process.env.ELEVENLABS_API_KEY = "test-only";
  globalThis.fetch = async () => new Response(null, { status: 429 });
  assert.deepEqual(await (await speak("Hello")).json(), { playback: "browser" });
  globalThis.fetch = async (_, init) => {
    assert.equal(JSON.parse(init.body).text, "Hello");
    assert.equal(init.headers["xi-api-key"], "test-only");
    return new Response(new Uint8Array([1, 2, 3]));
  };
  const mp3 = await speak("Hello");
  assert.equal(mp3.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual([...new Uint8Array(await mp3.arrayBuffer())], [1, 2, 3]);

  const issuer = Keypair.generate();
  process.env.SOLANA_DEVNET_SECRET_KEY = JSON.stringify([...issuer.secretKey]);
  const report = { attemptId: "attempt-1", createdAt: "2026-11-15T00:00:00Z", findings: [] };
  assert.equal(await attachSkillProof(report, "coding"), report);
  report.findings = [{ category: "correctness", rating: "ok" }, { category: "testing", rating: "strong" }];
  Connection.prototype.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58() });
  const digest = createHash("sha256").update(JSON.stringify([report.attemptId, "strong", report.createdAt])).digest("hex");
  const memo = "interviewlenz:skill:v1:" + digest;
  const signature = "1".repeat(64);
  let programId;
  Connection.prototype.sendRawTransaction = async (bytes) => {
    const tx = Transaction.from(bytes);
    assert(tx.verifySignatures());
    assert(tx.feePayer.equals(issuer.publicKey));
    assert.equal(tx.instructions.length, 1);
    programId = tx.instructions[0].programId;
    assert.equal(tx.instructions[0].data.toString(), memo);
    return signature;
  };
  const { skillProof } = await attachSkillProof(report, "coding");
  assert.equal(skillProof.digest, digest);
  assert(skillProof.explorerUrl.endsWith(signature + "?cluster=devnet"));
  const verify = async () => (await GET(new Request("http://localhost/?signature=" + signature + "&digest=" + digest))).json();
  Connection.prototype.getParsedTransaction = async () => null;
  assert.equal((await verify()).status, "pending");
  const instruction = { programId, parsed: memo };
  Connection.prototype.getParsedTransaction = async () => ({ meta: { err: null }, transaction: { message: {
    accountKeys: [{ signer: true, pubkey: issuer.publicKey }], instructions: [instruction],
  } } });
  assert.equal((await verify()).status, "confirmed");
  instruction.parsed = "unrelated";
  assert.equal((await verify()).status, "invalid");
  Connection.prototype.getLatestBlockhash = async () => { throw new Error("offline"); };
  assert.equal((await attachSkillProof(report, "coding")).skillProofUnavailable, true);
  console.log("Sponsor checks passed: TTS fallback and MP3, signed memo, report digest, confirmation, mismatch, RPC failure.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
