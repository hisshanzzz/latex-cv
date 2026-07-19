import type { Config, Context } from "@netlify/functions";
import {
  getAuthUser,
  json,
  preflight,
  progressStore,
} from "./_shared/helpers.mts";

export default async (req: Request, _context: Context) => {
  const early = preflight(req);
  if (early) return early;

  const user = await getAuthUser(req);
  if (!user) {
    return json(req, { error: "Login required to sync cloud progress." }, 401);
  }

  const store = progressStore();
  const key = `user:${user.sub}`;

  if (req.method === "GET") {
    const data = (await store.get(key, { type: "json" })) || {
      cleared: {},
      highScore: 0,
      hiveBest: 0,
      updatedAt: null,
    };
    return json(req, {
      user: { sub: user.sub, name: user.name, email: user.email },
      progress: data,
    });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "Invalid JSON body." }, 400);
    }

    const existing =
      ((await store.get(key, { type: "json" })) as Record<string, unknown>) ||
      {};
    const next = {
      cleared: body.cleared || existing.cleared || {},
      highScore: Math.max(
        Number(body.highScore) || 0,
        Number(existing.highScore) || 0
      ),
      hiveBest: Math.max(
        Number(body.hiveBest) || 0,
        Number(existing.hiveBest) || 0
      ),
      displayName: body.displayName || existing.displayName || user.name || "",
      track: body.track || existing.track || null,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(key, next);
    return json(req, { ok: true, progress: next });
  }

  return json(req, { error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/progress",
  method: ["GET", "POST", "OPTIONS"],
};
