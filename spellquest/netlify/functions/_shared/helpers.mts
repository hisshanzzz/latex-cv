import { getStore } from "@netlify/blobs";
import { createRemoteJWKSet, jwtVerify } from "jose";

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Teacher-Pin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

export function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(req),
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

export function progressStore() {
  return getStore({ name: "spellquest-progress", consistency: "strong" });
}

export function leaderboardStore() {
  return getStore({ name: "spellquest-leaderboard", consistency: "strong" });
}

export function classroomsStore() {
  return getStore({ name: "spellquest-classrooms", consistency: "strong" });
}

type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
};

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const org =
    (typeof Netlify !== "undefined" && Netlify.env.get("ASGARDEO_ORG")) ||
    process.env.ASGARDEO_ORG ||
    "";

  const regionRaw =
    (typeof Netlify !== "undefined" && Netlify.env.get("ASGARDEO_REGION")) ||
    process.env.ASGARDEO_REGION ||
    "eu";
  const region = String(regionRaw).toLowerCase() === "us" ? "us" : "eu";
  const apiHost =
    region === "eu" ? "https://api.eu.asgardeo.io" : "https://api.asgardeo.io";

  if (!org) {
    // Dev fallback: decode payload without verify (local only / misconfigured verify)
    try {
      const part = token.split(".")[1] || "";
      const padded = part.replace(/-/g, "+").replace(/_/g, "/");
      const json =
        typeof atob === "function"
          ? atob(padded)
          : Buffer.from(part, "base64url").toString("utf8");
      const payload = JSON.parse(json);
      if (!payload.sub) return null;
      return {
        sub: String(payload.sub),
        email: payload.email,
        name: payload.name || payload.username,
        username: payload.username,
      };
    } catch {
      return null;
    }
  }

  try {
    const issuer = `${apiHost}/t/${org}/oauth2/token`;
    const jwks = createRemoteJWKSet(new URL(`${apiHost}/t/${org}/oauth2/jwks`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: [issuer, `${apiHost}/t/${org}`, `${apiHost}/t/${org}/`],
    });
    return {
      sub: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email : undefined,
      name:
        typeof payload.name === "string"
          ? payload.name
          : typeof payload.username === "string"
            ? payload.username
            : undefined,
      username:
        typeof payload.username === "string" ? payload.username : undefined,
    };
  } catch {
    return null;
  }
}

export function teacherAuthorized(req: Request): boolean {
  const pin =
    (typeof Netlify !== "undefined" && Netlify.env.get("TEACHER_PIN")) ||
    process.env.TEACHER_PIN ||
    "";
  if (!pin) return false;
  return (req.headers.get("X-Teacher-Pin") || "") === pin;
}

export function safeName(input: unknown, fallback = "Player"): string {
  const raw = String(input || "")
    .replace(/[^\w\s.\-']/g, "")
    .trim()
    .slice(0, 32);
  return raw || fallback;
}
