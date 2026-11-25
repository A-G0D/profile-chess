// Small chess engine: negamax alpha-beta, material plus piece-square tables. Port of engine.py.
// The search is capped by NODE COUNT, not time: Date.now() and performance.now() do not advance in a Worker.
import { isUpper } from "./chess.js";

const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const MATE = 100000;
export const MAX_DEPTH = 3;
export const COLD_CAP = 50; // first search in a fresh isolate: JIT is cold, ~3.3 ms worst on 10 positions (scripts/bench.js 50)
let warm = false;
export const resetWarm = () => { warm = false; }; // tests only
export const NODE_CAP = 1000; // warm worst case ~5 ms on 10 middlegame positions, see README and scripts/bench.js

// Simplified-evaluation tables, written rank 8 first from White's side.
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50];



export function evaluate(pos) {
  const endgame = !pos.board.includes("Q") && !pos.board.includes("q");
  let score = 0;
  pos.board.forEach((p, s) => {
    if (p === ".") return;
    const k = p.toUpperCase(), white = isUpper(p);
    const i = white ? (7 - Math.floor(s / 8)) * 8 + (s % 8) : s;
    const v = VALUE[k] + (k === "K" && endgame ? KING_END : PST[k])[i];
    score += white ? v : -v;
  });
  return pos.turn === "w" ? score : -score;
}

function order(pos, moves) {
  const b = pos.board;
  const key = (m) => {
    const victim = b[m[1]];
    const gain = victim !== "." ? 10 * VALUE[victim.toUpperCase()] - VALUE[b[m[0]].toUpperCase()] : 0;
    return -(gain + (m[2] === "q" ? 800 : 0));
  };
  return moves.map((m) => [key(m), m]).sort((a, c) => a[0] - c[0]).map((x) => x[1]); // stable
}

class OutOfNodes extends Error {}

class Search {
  constructor(cap) { this.nodes = 0; this.cap = cap; }
  tick() { if (++this.nodes > this.cap) throw new OutOfNodes(); }

  quiesce(pos, alpha, beta) {
    this.tick();
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    alpha = Math.max(alpha, stand);
    const caps = pos.pseudo().filter((m) => pos.board[m[1]] !== "." || m[2] === "q");
    for (const m of order(pos, caps)) {
      const n = pos.makeLegal(m);
      if (!n) continue;
      const score = -this.quiesce(n, -beta, -alpha);
      if (score >= beta) return score;
      alpha = Math.max(alpha, score);
    }
    return alpha;
  }

  search(pos, depth, alpha, beta, ply) {
    this.tick();
    if (pos.half >= 100) return 0;
    if (depth === 0) return this.quiesce(pos, alpha, beta);
    let best = -MATE, anyLegal = false;
    for (const m of order(pos, pos.pseudo())) {
      const n = pos.makeLegal(m);
      if (!n) continue;
      anyLegal = true;
      const score = -this.search(n, depth - 1, -beta, -alpha, ply + 1);
      if (score > best) best = score;
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    if (!anyLegal) return pos.inCheck() ? -(MATE - ply) : 0;
    return best;
  }
}

// mulberry32: small deterministic PRNG, seeded per (seed, ply)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cmpMove = (a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);

/**
 * Deterministic for (position, seed, ply, cap). Iterative deepening, depth 1 to MAX_DEPTH, one root
 * score per move per depth. A pass that hits the node cap is dropped and the last completed one is used;
 * if none completes, moves are ranked by static evaluation alone. Returns { move, nodes, depth } or null when no legal move.
 * seen maps pos.key() to a count; early plies pick randomly among near-best moves.
 */
export function bestMove(pos, seed, ply, seen = {}, cap) {
  cap ??= warm ? NODE_CAP : COLD_CAP;
  warm = true;
  const root = order(pos, pos.pseudo()).map((m) => [m, pos.makeLegal(m)]).filter(([, n]) => n);
  if (!root.length) return null;
  const s = new Search(Infinity);
  let scored = null, depth = 0;
  for (let d = 1; d <= MAX_DEPTH; d++) {
    s.cap = cap;
    try {
      const cur = root.map(([m, n]) => [-s.search(n, d - 1, -MATE, MATE, 1) - 40 * (seen[n.key()] ?? 0), m]);
      scored = cur; depth = d;
    } catch (e) {
      if (!(e instanceof OutOfNodes)) throw e;
      break;
    }
  }
  // Depth 1 itself ran out of nodes: fall back to one static evaluation per move, no search.
  if (!scored) scored = root.map(([m, n]) => [-evaluate(n) - 40 * (seen[n.key()] ?? 0), m]);
  const top = Math.max(...scored.map((x) => x[0]));
  const slack = ply < 10 ? 30 : 0;
  const pool = scored.filter((x) => x[0] >= top - slack).map((x) => x[1]).sort(cmpMove);
  return { move: pool[Math.floor(rng(seed * 1000 + ply)() * pool.length)], nodes: s.nodes, depth };
}
