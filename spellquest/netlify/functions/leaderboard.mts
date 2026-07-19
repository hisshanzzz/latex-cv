import type { Config, Context } from "@netlify/functions";
import {
  getAuthUser,
  json,
  leaderboardStore,
  preflight,
  safeName,
} from "./_shared/helpers.mts";

type ScoreRow = {
  id: string;
  name: string;
  score: number;
  mode: string;
  track: string;
  at: string;
  userSub?: string;
};

async function readBoard(prefix: string): Promise<ScoreRow[]> {
  const store = leaderboardStore();
  const data = (await store.get(`board:${prefix}`, { type: "json" })) as
    | ScoreRow[]
    | null;
  return Array.isArray(data) ? data : [];
}

async function writeBoard(prefix: string, rows: ScoreRow[]) {
  const store = leaderboardStore();
  const trimmed = rows
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  await store.setJSON(`board:${prefix}`, trimmed);
  return trimmed;
}

export default async (req: Request, _context: Context) => {
  const early = preflight(req);
  if (early) return early;

  const url = new URL(req.url);
  const track = (url.searchParams.get("track") || "all").slice(0, 24);
  const mode = (url.searchParams.get("mode") || "bee").slice(0, 16);
  const boardKey = `${mode}:${track}`;

  if (req.method === "GET") {
    const rows = await readBoard(boardKey);
    return json(req, { track, mode, scores: rows });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "Invalid JSON body." }, 400);
    }

    const score = Math.max(0, Math.min(100000, Number(body.score) || 0));
    if (score < 1) return json(req, { error: "Score too low." }, 400);

    const user = await getAuthUser(req);
    const name = safeName(
      body.name || user?.name || user?.email || "Guest",
      "Guest"
    );
    const rowTrack = String(body.track || track || "all").slice(0, 24);
    const rowMode = String(body.mode || mode || "bee").slice(0, 16);
    const key = `${rowMode}:${rowTrack}`;

    const rows = await readBoard(key);
    const row: ScoreRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      score,
      mode: rowMode,
      track: rowTrack,
      at: new Date().toISOString(),
      userSub: user?.sub,
    };
    rows.push(row);
    const saved = await writeBoard(key, rows);
    return json(req, { ok: true, scores: saved, submitted: row });
  }

  return json(req, { error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/leaderboard",
  method: ["GET", "POST", "OPTIONS"],
};
