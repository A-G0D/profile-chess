import { DurableObject } from "cloudflare:workers";
import { parseClick } from "./lib.js";
import { hitSquare, rateLimit, newGame, click, isPlay } from "./game.js";
import { renderSvg } from "./render.js";

const HOME = "https://github.com/A-G0D";
const redirect = () => new Response(null, { status: 302, headers: { Location: HOME, "Cache-Control": "no-store" } });

export class Canvas extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // cells and log belong to the old pixel canvas: created if missing, never read or written again.
    this.sql.exec("CREATE TABLE IF NOT EXISTS cells(i INTEGER PRIMARY KEY, c INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, ip TEXT, cell INTEGER, color INTEGER, prev INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS rl(ip TEXT PRIMARY KEY, last INTEGER, day_start INTEGER, n INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS games(id INTEGER PRIMARY KEY, result TEXT, reason TEXT, started INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS moves(game INTEGER, ply INTEGER, uci TEXT, san TEXT, fen TEXT, PRIMARY KEY(game, ply))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)");
  }
  q(sql, ...a) { return this.sql.exec(sql, ...a).toArray(); }

  load() {
    let g = this.q("SELECT id,result,reason FROM games ORDER BY id DESC LIMIT 1")[0];
    if (!g) { this.sql.exec("INSERT INTO games VALUES(1,NULL,NULL,?)", Date.now()); g = { id: 1, result: null }; }
    const score = { v: 0, e: 0, d: 0 };
    for (const r of this.q("SELECT result, COUNT(*) AS c FROM games WHERE result IS NOT NULL GROUP BY result"))
      score[{ "1-0": "v", "0-1": "e", "1/2-1/2": "d" }[r.result]] += r.c;
    const sel = this.q("SELECT v FROM meta WHERE k='sel'")[0];
    return {
      game: g.id,
      moves: this.q("SELECT uci,san,fen FROM moves WHERE game=? ORDER BY ply", g.id),
      sel: sel ? JSON.parse(sel.v) : null,
      result: g.result ? { r: g.result, reason: g.reason } : null,
      score,
    };
  }
  save(before, after, now) {
    if (after.game !== before.game) this.sql.exec("INSERT INTO games VALUES(?,NULL,NULL,?)", after.game, now);
    after.moves.slice(after.game === before.game ? before.moves.length : 0).forEach((m, i) =>
      this.sql.exec("INSERT INTO moves VALUES(?,?,?,?,?)", after.game, (after.game === before.game ? before.moves.length : 0) + i, m.uci, m.san, m.fen));
    if (after.result) this.sql.exec("UPDATE games SET result=?, reason=? WHERE id=?", after.result.r, after.result.reason, after.game);
    this.sql.exec("INSERT OR REPLACE INTO meta VALUES('sel',?)", JSON.stringify(after.sel));
  }

  svg() { return renderSvg(this.load(), Date.now()); }

  /** Whole click is one synchronous method, so concurrent clicks cannot interleave. */
  click(ip, x, y) {
    const now = Date.now(), before = this.load(), after = click(before, hitSquare(x, y), now);
    if (isPlay(before, after)) {
      const row = rateLimit(this.q("SELECT last,day_start,n FROM rl WHERE ip=?", ip)[0], now);
      if (!row) return false;
      this.sql.exec("INSERT OR REPLACE INTO rl VALUES(?,?,?,?)", ip, row.last, row.day_start, row.n);
    }
    this.save(before, after, now);
    return true;
  }

  reset() {
    const now = Date.now(), g = this.load();
    this.sql.exec("INSERT INTO games VALUES(?,NULL,NULL,?)", g.game + 1, now);
    this.sql.exec("INSERT OR REPLACE INTO meta VALUES('sel','null')");
  }
  /** Undo the last n plies of the current game; n must leave white to move. Returns plies removed or -1. */
  rollback(n) {
    const g = this.load(), keep = g.moves.length - n;
    if (n < 1 || keep < 0 || keep % 2) return -1;
    this.sql.exec("DELETE FROM moves WHERE game=? AND ply>=?", g.game, keep);
    this.sql.exec("UPDATE games SET result=NULL, reason=NULL WHERE id=?", g.game);
    this.sql.exec("INSERT OR REPLACE INTO meta VALUES('sel','null')");
    return n;
  }
}

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function safeEq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const stub = env.CANVAS.get(env.CANVAS.idFromName("main"));

    if (url.pathname === "/canvas.svg")
      return new Response(await stub.svg(), { headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      } });

    if (url.pathname === "/click") {
      const p = parseClick(url.search);
      if (p) await stub.click(await sha(req.headers.get("CF-Connecting-IP") || "unknown"), p.x, p.y);
      return redirect();
    }

    if (url.pathname.startsWith("/admin/") && req.method === "POST") {
      if (!safeEq(req.headers.get("X-Admin-Token"), env.ADMIN_TOKEN)) return new Response("unauthorized", { status: 401 });
      if (url.pathname === "/admin/reset") { await stub.reset(); return new Response("ok\n"); }
      if (url.pathname === "/admin/rollback") {
        const n = Number(url.searchParams.get("plies"));
        const done = Number.isInteger(n) ? await stub.rollback(n) : -1;
        return done < 0 ? new Response("bad plies", { status: 400 }) : new Response(`undone ${done}\n`);
      }
    }
    if (url.pathname === "/") return redirect();
    return new Response("not found", { status: 404 });
  },
};
