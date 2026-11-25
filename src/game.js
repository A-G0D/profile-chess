// Pure click-flow state machine. No Durable Object, no clock: callers pass `now` in ms.
import { Position, START, isUpper, outcome, uci } from "./chess.js";
import { bestMove } from "./engine.js";

export const SEL_MS = 90000, GAP_MS = 3000, DAY_MAX = 300, DAY_MS = 86400000;
export const CELL = 50, OX = 28, OY = 14; // board geometry, shared with render.js

/** Square index (a1 = 0) under pixel x,y, or null when outside the board. White is at the bottom. */
export function hitSquare(x, y) {
  const f = Math.floor((x - OX) / CELL), r = Math.floor((y - OY) / CELL);
  return x >= OX && y >= OY && f < 8 && r < 8 ? (7 - r) * 8 + f : null;
}

/** row is the rl row {last, day_start, n} or undefined. Returns the row to store, or null if rejected. */
export function rateLimit(row, now) {
  let { last = 0, day_start = now, n = 0 } = row || {};
  if (now - day_start >= DAY_MS) { day_start = now; n = 0; }
  if (now - last < GAP_MS || n >= DAY_MAX) return null;
  return { last: now, day_start, n: n + 1 };
}

export const newGame = (game, score = { v: 0, e: 0, d: 0 }) =>
  ({ game, moves: [], sel: null, result: null, score });

export const fenOf = (s) => (s.moves.length ? s.moves[s.moves.length - 1].fen : START);
export const positionOf = (s) => Position.fromFen(fenOf(s));
const keyOf = (fen) => fen.split(" ").slice(0, 4).join(" ");

export function seenOf(s) {
  const seen = {};
  for (const fen of [START, ...s.moves.map((m) => m.fen)]) seen[keyOf(fen)] = (seen[keyOf(fen)] ?? 0) + 1;
  return seen;
}

/** The selection if it is still alive at `now`, else null. */
export const liveSel = (s, now) => (s.sel && now - s.sel.ts <= SEL_MS ? s.sel : null);

/** Legal white moves from sq (promotion collapsed to queen only). */
export const movesFrom = (pos, sq) => pos.legal().filter((m) => m[0] === sq && (m[2] === "" || m[2] === "q"));

const SCORE_KEY = { "1-0": "v", "0-1": "e", "1/2-1/2": "d" };

function push(s, pos, m, seen) {
  const san = pos.san(m), next = pos.makeLegal(m);
  const fen = next.fen();
  seen[keyOf(fen)] = (seen[keyOf(fen)] ?? 0) + 1;
  const moves = [...s.moves, { uci: uci(m), san, fen }];
  const end = outcome(next, seen);
  const out = { ...s, moves, sel: null };
  if (end) {
    out.result = { r: end[0], reason: end[1] };
    out.score = { ...s.score, [SCORE_KEY[end[0]]]: s.score[SCORE_KEY[end[0]]] + 1 };
  }
  return [out, next];
}

/** One visitor click. sq is a square index or null. Returns the next state. */
export function click(state, sq, now) {
  if (state.result) return newGame(state.game + 1, state.score); // this click only restarts
  const pos = positionOf(state), sel = liveSel(state, now);
  if (sq !== null) {
    const m = sel && movesFrom(pos, sel.sq).find((x) => x[1] === sq);
    if (m) {
      const seen = seenOf(state);
      let [s, next] = push(state, pos, m, seen);
      if (!s.result) {
        const reply = bestMove(next, state.game, s.moves.length, seen);
        [s] = push(s, next, reply.move, seen);
      }
      return s;
    }
    if (isUpper(pos.board[sq])) return { ...state, sel: { sq, ts: now } };
  }
  return { ...state, sel: null };
}
