import type { Config, Context } from "@netlify/functions";
import {
  classroomsStore,
  json,
  leaderboardStore,
  preflight,
  teacherAuthorized,
} from "./_shared/helpers.mts";

export default async (req: Request, _context: Context) => {
  const early = preflight(req);
  if (early) return early;

  if (!teacherAuthorized(req)) {
    return json(
      req,
      {
        error:
          "Teacher PIN required. Set TEACHER_PIN in Netlify env and send X-Teacher-Pin header.",
      },
      401
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (req.method === "GET" && action === "overview") {
    const board = leaderboardStore();
    const { blobs } = await board.list({ prefix: "board:" });
    const boards: Record<string, unknown> = {};
    for (const b of blobs.slice(0, 20)) {
      boards[b.key] = await board.get(b.key, { type: "json" });
    }
    return json(req, {
      ok: true,
      boards,
      tip: "Share SpellQuest with a classroom code from POST action=classroom.",
    });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const act = String(body.action || action);

    if (act === "classroom") {
      const code = String(body.code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
      if (code.length < 4) {
        return json(req, { error: "Classroom code needs 4+ letters/numbers." }, 400);
      }
      const rooms = classroomsStore();
      const room = {
        code,
        name: String(body.name || "English Pro Hub class").slice(0, 80),
        track: String(body.track || "builder"),
        createdAt: new Date().toISOString(),
      };
      await rooms.setJSON(`room:${code}`, room);
      return json(req, { ok: true, classroom: room });
    }

    return json(req, { error: "Unknown teacher action." }, 400);
  }

  return json(req, { error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/teacher",
  method: ["GET", "POST", "OPTIONS"],
};
