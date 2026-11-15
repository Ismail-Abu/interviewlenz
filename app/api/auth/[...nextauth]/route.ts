import NextAuth, { type AuthOptions } from "next-auth";
import type { NextRequest } from "next/server";

type Context = { params: Promise<{ nextauth: string[] }> };

async function auth(request: NextRequest, context: Context) {
  const issuer = process.env.SSOJET_ISSUER?.replace(/\/+$/, "");
  const clientId = process.env.SSOJET_CLIENT_ID;
  const clientSecret = process.env.SSOJET_CLIENT_SECRET;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!issuer || !clientId || !clientSecret || !secret) {
    const { nextauth } = await context.params;
    if (request.method === "GET" && nextauth.join("/") === "providers") {
      return Response.json({}, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Sign-in is unavailable." }, { status: 503 });
  }

  const options: AuthOptions = {
    secret,
    session: { strategy: "jwt" },
    providers: [{
      id: "ssojet", name: "SSOJet", type: "oauth",
      issuer, wellKnown: issuer + "/.well-known/openid-configuration",
      clientId, clientSecret, idToken: true,
      checks: ["pkce", "state", "nonce"],
      authorization: { params: { scope: "openid profile email" } },
      profile(claims) {
        if (typeof claims.sub !== "string" || !claims.sub) throw new Error("Missing subject");
        return { id: claims.sub, name: claims.name ?? claims.given_name ?? claims.email ?? "Signed in", email: claims.email ?? null };
      },
    }],
  };
  return NextAuth(request, context, options);
}

export { auth as GET, auth as POST };
