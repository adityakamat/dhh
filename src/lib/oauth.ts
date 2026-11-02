import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { env, isNative } from "./env";

export type Provider = "spotify" | "google";

interface Token {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface ProviderConfig {
  clientId?: string;
  authUrl: string;
  tokenUrl?: string;
  scopes: string[];
  /** Spotify supports PKCE from a browser. Google web clients only allow the token (implicit) flow without a secret. */
  flow: "pkce" | "implicit";
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  spotify: {
    clientId: env.spotifyClientId,
    authUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["playlist-modify-private", "playlist-modify-public"],
    flow: "pkce",
  },
  google: {
    clientId: env.googleClientId,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/youtube"],
    flow: "implicit",
  },
};

const TOKEN_KEY = (p: Provider) => `dhh.token.${p}`;
const PENDING_KEY = "dhh.oauth.pending";

export function isConfigured(p: Provider): boolean {
  return !!PROVIDERS[p].clientId;
}

/** Google blocks OAuth inside embedded webviews; native YouTube login needs a native sign-in plugin. */
export function canSignIn(p: Provider): boolean {
  return isConfigured(p) && !(p === "google" && isNative);
}

function readToken(p: Provider): Token | null {
  const raw = localStorage.getItem(TOKEN_KEY(p));
  return raw ? (JSON.parse(raw) as Token) : null;
}

export function isSignedIn(p: Provider): boolean {
  const t = readToken(p);
  return !!t && (t.expiresAt > Date.now() || !!t.refreshToken);
}

export function signOut(p: Provider) {
  localStorage.removeItem(TOKEN_KEY(p));
  notify();
}

function saveToken(p: Provider, body: { access_token: string; refresh_token?: string; expires_in: number | string }) {
  const prev = readToken(p);
  const token: Token = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? prev?.refreshToken,
    expiresAt: Date.now() + (Number(body.expires_in) - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY(p), JSON.stringify(token));
  notify();
}

export async function getAccessToken(p: Provider): Promise<string> {
  const t = readToken(p);
  if (!t) throw new AuthRequired(p);
  if (t.expiresAt > Date.now()) return t.accessToken;
  const cfg = PROVIDERS[p];
  if (!t.refreshToken || !cfg.tokenUrl) {
    signOut(p);
    throw new AuthRequired(p);
  }
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refreshToken, client_id: cfg.clientId! }),
  });
  if (!res.ok) {
    signOut(p);
    throw new AuthRequired(p);
  }
  saveToken(p, await res.json());
  return readToken(p)!.accessToken;
}

export class AuthRequired extends Error {
  constructor(public provider: Provider) {
    super(`Sign in to ${provider === "spotify" ? "Spotify" : "YouTube"} first.`);
  }
}

// ---- Sign-in flow ----

function randomString(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(arr);
}
function base64url(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function signIn(p: Provider, returnTo = location.hash || "#/") {
  const cfg = PROVIDERS[p];
  if (!cfg.clientId) throw new Error(`${p} client ID is not configured (see .env.example).`);
  const state = `${p}.${randomString(12)}`;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: env.redirectUri,
    scope: cfg.scopes.join(" "),
    state,
  });
  const pending: Record<string, string> = { state, returnTo };
  if (cfg.flow === "pkce") {
    const verifier = randomString(64);
    const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    pending.verifier = verifier;
    params.set("response_type", "code");
    params.set("code_challenge_method", "S256");
    params.set("code_challenge", challenge);
  } else {
    params.set("response_type", "token");
    params.set("include_granted_scopes", "true");
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const url = `${cfg.authUrl}?${params}`;
  if (isNative) await Browser.open({ url });
  else location.assign(url);
}

/**
 * Finish a sign-in if `url` is an OAuth redirect. Returns the hash route to go back to, or null.
 * Spotify returns `?code=…&state=…`; Google's token flow returns `#access_token=…&state=…`.
 */
export async function completeSignIn(url: string): Promise<string | null> {
  const u = new URL(url);
  const fragment = new URLSearchParams(u.hash.replace(/^#\/?/, ""));
  const params = u.searchParams.get("state") ? u.searchParams : fragment;
  const state = params.get("state");
  if (!state) return null;

  const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as Record<string, string> | null;
  localStorage.removeItem(PENDING_KEY);
  if (!pending || pending.state !== state) throw new Error("Sign-in state mismatch — please try again.");
  const p = state.split(".")[0] as Provider;
  const cfg = PROVIDERS[p];

  if (params.get("error")) throw new Error(`Sign-in cancelled: ${params.get("error")}`);

  if (cfg.flow === "pkce") {
    const res = await fetch(cfg.tokenUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.get("code")!,
        redirect_uri: env.redirectUri,
        client_id: cfg.clientId!,
        code_verifier: pending.verifier,
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
    saveToken(p, await res.json());
  } else {
    saveToken(p, { access_token: params.get("access_token")!, expires_in: params.get("expires_in") ?? 3600 });
  }
  return pending.returnTo;
}

/** On native, OAuth redirects come back through the custom URL scheme. */
export function listenForNativeRedirects(onDone: (returnTo: string | null, error?: Error) => void) {
  if (!isNative) return;
  App.addListener("appUrlOpen", async ({ url }) => {
    try {
      const returnTo = await completeSignIn(url);
      await Browser.close().catch(() => {});
      onDone(returnTo);
    } catch (e) {
      onDone(null, e as Error);
    }
  });
}

// ---- Tiny change notification so the header can re-render ----
const listeners = new Set<() => void>();
export function onAuthChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}
