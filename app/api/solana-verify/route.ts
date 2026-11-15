import { verifySkillProof } from "@/lib/solana";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const signature = params.get("signature") ?? "";
  const digest = params.get("digest") ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) || !/^[a-f0-9]{64}$/.test(digest)) {
    return Response.json({ error: "Invalid proof reference." }, { status: 400 });
  }
  try {
    const status = await verifySkillProof(signature, digest);
    return Response.json({ status, signature, explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet` }, {
      status: status === "unavailable" ? 503 : 200, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
