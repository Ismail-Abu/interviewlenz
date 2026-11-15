// Optional SSOJet sign-in: OIDC authorization code flow with PKCE, as a
// public browser client. Configure with NEXT_PUBLIC_SSOJET_ISSUER (the OIDC
// issuer URL from the SSOJet dashboard) and NEXT_PUBLIC_SSOJET_CLIENT_ID; both
// are public values. Register <origin>/auth/callback as the redirect URI.
//
// Sign-in is cosmetic in this app: nothing is gated on it, and the ID token is
// only decoded to show a name. It is NOT verified here, so never use it for
// authorization. Tokens live in sessionStorage (this tab) and are never sent
// to Interviewlenz servers.

const ISSUER = (process.env.NEXT_PUBLIC_SSOJET_ISSUER ?? "").replace(/\/+$/, "");
const CLIENT_ID = process.env.NEXT_PUBLIC_SSOJET_CLIENT_ID ?? "";
const PENDING = "interviewlenz:ssojet:pending";
const USER = "interviewlenz:ssojet:user";

export const ssojetConfigured = () => Boolean(ISSUER && CLIENT_ID);
export const redirectUri = () => `${window.location.origin}/auth/callback`;

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

async function discover(): Promise<Discovery> {
  const res = await fetch(`${ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error("discovery");
  const d = (await res.json()) as Partial<Discovery>;
  if (typeof d.authorization_endpoint !== "string" || typeof d.token_endpoint !== "string") throw new Error("discovery");
  return d as Discovery;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function beginSignIn(): Promise<void> {
  const d = await discover();
  const verifier = random(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = random(16);
  sessionStorage.setItem(PENDING, JSON.stringify({ state, verifier, tokenEndpoint: d.token_endpoint }));
  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  window.location.assign(url.toString());
}

export interface SignedInUser {
  name: string;
}

function nameFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    const n = [claims.name, claims.given_name, claims.email].find((v) => typeof v === "string" && v.trim());
    return typeof n === "string" ? n.trim().slice(0, 60) : null;
  } catch {
    return null;
  }
}

// Called on /auth/callback. Resolves to the signed-in user or throws a short,
// displayable message.
export async function completeSignIn(params: URLSearchParams): Promise<SignedInUser> {
  const raw = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING);
  if (params.get("error")) throw new Error("Sign-in was cancelled or refused.");
  const pending = raw ? (JSON.parse(raw) as { state: string; verifier: string; tokenEndpoint: string }) : null;
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) throw new Error("This sign-in link is invalid or expired. Try again.");
  const res = await fetch(pending.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: pending.verifier,
    }),
  });
  if (!res.ok) throw new Error("SSOJet didn't complete the sign-in. Try again.");
  const tokens = (await res.json()) as { id_token?: unknown };
  const name = typeof tokens.id_token === "string" ? nameFromIdToken(tokens.id_token) : null;
  const user = { name: name ?? "Signed in" };
  sessionStorage.setItem(USER, JSON.stringify(user));
  return user;
}

// A tiny store for useSyncExternalStore: the snapshot is the stored name.
const listeners = new Set<() => void>();
export function subscribeUser(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function userName(): string | null {
  try {
    const u = JSON.parse(sessionStorage.getItem(USER) ?? "null") as SignedInUser | null;
    return u && typeof u.name === "string" ? u.name : null;
  } catch {
    return null;
  }
}
export const serverUserName = () => null;

export function signOut() {
  try {
    sessionStorage.removeItem(USER);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}
