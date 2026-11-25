// Legal chess: move generation, FEN, SAN, game-end detection. Port of chess.py.
// Squares 0..63 with a1 = 0 ... h8 = 63. A move is [from, to, promo], promo is "" or "q"|"r"|"b"|"n".
// Pieces are FEN letters, "." is empty.

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const isUpper = (p) => p >= "A" && p <= "Z"; // "." is neither case
export const name = (sq) => FILES[sq % 8] + (Math.floor(sq / 8) + 1);
export const square = (t) => FILES.indexOf(t[0]) + 8 * (Number(t[1]) - 1);
export const uci = (m) => name(m[0]) + name(m[1]) + m[2];
export const sameMove = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

function ray(sq, dr, df) {
  const out = [];
  let r = Math.floor(sq / 8) + dr, f = (sq % 8) + df;
  while (r >= 0 && r < 8 && f >= 0 && f < 8) { out.push(r * 8 + f); r += dr; f += df; }
  return out;
}
function jumps(sq, steps) {
  const r = Math.floor(sq / 8), f = sq % 8;
  return steps.filter(([dr, df]) => r + dr >= 0 && r + dr < 8 && f + df >= 0 && f + df < 8)
    .map(([dr, df]) => (r + dr) * 8 + f + df);
}
const range64 = [...Array(64).keys()];
const ORTH_RAYS = range64.map((s) => ORTH.map(([a, b]) => ray(s, a, b)));
const DIAG_RAYS = range64.map((s) => DIAG.map(([a, b]) => ray(s, a, b)));
const KSTEPS = [];
for (const a of [1, -1, 2, -2]) for (const b of [1, -1, 2, -2]) if (Math.abs(a) !== Math.abs(b)) KSTEPS.push([a, b]);
const KNIGHT = range64.map((s) => jumps(s, KSTEPS));
const KING = range64.map((s) => jumps(s, [...ORTH, ...DIAG]));
const PAWN_ATT = {
  w: range64.map((s) => jumps(s, [[1, -1], [1, 1]])),
  b: range64.map((s) => jumps(s, [[-1, -1], [-1, 1]])),
};
const RIGHTS = { 0: "Q", 7: "K", 4: "KQ", 56: "q", 63: "k", 60: "kq" };

export class Position {
  constructor(board, turn, castling, ep, half, full) {
    this.board = board; this.turn = turn; this.castling = castling;
    this.ep = ep; this.half = half; this.full = full;
  }

  static fromFen(fen) {
    const [placement, turn, castling, ep, half, full] = fen.split(" ");
    const board = Array(64).fill(".");
    placement.split("/").forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (ch >= "0" && ch <= "9") f += Number(ch);
        else board[(7 - i) * 8 + f++] = ch;
      }
    });
    return new Position(board, turn, castling === "-" ? "" : castling, ep === "-" ? -1 : square(ep),
      Number(half), Number(full));
  }

  fen() {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = "", empty = 0;
      for (const p of this.board.slice(r * 8, r * 8 + 8)) {
        if (p === ".") empty++;
        else { row += (empty ? empty : "") + p; empty = 0; }
      }
      rows.push(row + (empty ? empty : ""));
    }
    return `${rows.join("/")} ${this.turn} ${this.castling || "-"} ${this.ep >= 0 ? name(this.ep) : "-"} ${this.half} ${this.full}`;
  }

  key() { return this.fen().split(" ").slice(0, 4).join(" "); }

  attacked(sq, by) {
    const b = this.board, up = by === "w";
    const [pawn, knight, king, rook, bishop, queen] = up ? "PNKRBQ" : "pnkrbq";
    if (PAWN_ATT[up ? "b" : "w"][sq].some((s) => b[s] === pawn)) return true;
    if (KNIGHT[sq].some((s) => b[s] === knight) || KING[sq].some((s) => b[s] === king)) return true;
    for (const [rays, hit] of [[ORTH_RAYS[sq], rook], [DIAG_RAYS[sq], bishop]]) {
      for (const r of rays) {
        for (const s of r) {
          if (b[s] !== ".") {
            if (b[s] === hit || b[s] === queen) return true;
            break;
          }
        }
      }
    }
    return false;
  }

  inCheck() {
    const opp = this.turn === "w" ? "b" : "w";
    return this.attacked(this.board.indexOf(this.turn === "w" ? "K" : "k"), opp);
  }

  pseudo() {
    const b = this.board, w = this.turn === "w", opp = w ? "b" : "w";
    const moves = [];
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (p === "." || isUpper(p) !== w) continue;
      const k = p.toUpperCase();
      if (k === "P") {
        const r = Math.floor(s / 8), step = w ? 8 : -8;
        const targets = [];
        if (b[s + step] === ".") {
          targets.push(s + step);
          if (r === (w ? 1 : 6) && b[s + 2 * step] === ".") moves.push([s, s + 2 * step, ""]);
        }
        for (const t of PAWN_ATT[this.turn][s]) {
          if ((b[t] !== "." && isUpper(b[t]) !== w) || t === this.ep) targets.push(t);
        }
        for (const t of targets) {
          if (Math.floor(t / 8) === (w ? 7 : 0)) for (const c of "qrbn") moves.push([s, t, c]);
          else moves.push([s, t, ""]);
        }
      } else if (k === "N" || k === "K") {
        for (const t of (k === "N" ? KNIGHT : KING)[s]) {
          if (b[t] === "." || isUpper(b[t]) !== w) moves.push([s, t, ""]);
        }
        if (k === "K" && s === (w ? 4 : 60)) {
          const rook = w ? "R" : "r";
          if (this.castling.includes(w ? "K" : "k") && b[s + 1] === "." && b[s + 2] === "." &&
              b[s + 3] === rook && !this.attacked(s, opp) && !this.attacked(s + 1, opp)) moves.push([s, s + 2, ""]);
          if (this.castling.includes(w ? "Q" : "q") && b[s - 1] === "." && b[s - 2] === "." && b[s - 3] === "." &&
              b[s - 4] === rook && !this.attacked(s, opp) && !this.attacked(s - 1, opp)) moves.push([s, s - 2, ""]);
        }
      } else {
        const rays = [...("RQ".includes(k) ? ORTH_RAYS[s] : []), ...("BQ".includes(k) ? DIAG_RAYS[s] : [])];
        for (const r of rays) {
          for (const t of r) {
            if (b[t] === ".") moves.push([s, t, ""]);
            else { if (isUpper(b[t]) !== w) moves.push([s, t, ""]); break; }
          }
        }
      }
    }
    return moves;
  }

  /** Apply a pseudo-legal move; returns a new Position. */
  make(m) {
    const [f, t, promo] = m;
    const b = this.board.slice(), p = b[f], w = this.turn === "w";
    let capture = b[t] !== ".";
    b[t] = promo ? (w ? promo.toUpperCase() : promo) : p;
    b[f] = ".";
    let ep = -1;
    if (p === "P" || p === "p") {
      if (t === this.ep && f % 8 !== t % 8) { b[w ? t - 8 : t + 8] = "."; capture = true; }
      else if (Math.abs(t - f) === 16) ep = (f + t) / 2;
    } else if ((p === "K" || p === "k") && Math.abs(t - f) === 2) {
      if (t > f) { b[f + 1] = b[f + 3]; b[f + 3] = "."; } else { b[f - 1] = b[f - 4]; b[f - 4] = "."; }
    }
    let castling = this.castling;
    for (const sq of [f, t]) for (const c of RIGHTS[sq] || "") castling = castling.replace(c, "");
    return new Position(b, w ? "b" : "w", castling, ep,
      capture || p === "P" || p === "p" ? 0 : this.half + 1, this.full + (w ? 0 : 1));
  }

  /** Like make, but null if the move leaves the mover's own king attacked. */
  makeLegal(m) {
    const n = this.make(m);
    const king = n.board.indexOf(this.turn === "w" ? "K" : "k");
    return n.attacked(king, n.turn) ? null : n;
  }

  legal() { return this.pseudo().filter((m) => this.makeLegal(m)); }

  san(m) {
    const [f, t, promo] = m;
    const p = this.board[f], k = p.toUpperCase();
    let s;
    if (k === "K" && Math.abs(t - f) === 2) s = t > f ? "O-O" : "O-O-O";
    else {
      const capture = this.board[t] !== "." || (k === "P" && t === this.ep && f % 8 !== t % 8);
      if (k === "P") s = (capture ? FILES[f % 8] + "x" : "") + name(t) + (promo ? "=" + promo.toUpperCase() : "");
      else {
        const rivals = this.legal().filter((o) => o[1] === t && o[0] !== f && this.board[o[0]] === p).map((o) => o[0]);
        let dis = "";
        if (rivals.length) {
          if (rivals.every((o) => o % 8 !== f % 8)) dis = FILES[f % 8];
          else if (rivals.every((o) => Math.floor(o / 8) !== Math.floor(f / 8))) dis = String(Math.floor(f / 8) + 1);
          else dis = name(f);
        }
        s = k + dis + (capture ? "x" : "") + name(t);
      }
    }
    const n = this.make(m);
    if (n.inCheck()) s += n.legal().length ? "+" : "#";
    return s;
  }
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const kids = pos.pseudo().map((m) => pos.makeLegal(m)).filter(Boolean);
  return depth === 1 ? kids.length : kids.reduce((a, n) => a + perft(n, depth - 1), 0);
}

function insufficient(board) {
  const rest = [];
  board.forEach((p, s) => { if (p !== "." && p !== "K" && p !== "k") rest.push([s, p]); });
  if (rest.length <= 1 && rest.every(([, p]) => "NBnb".includes(p))) return true;
  return rest.every(([, p]) => p === "B" || p === "b") &&
    new Set(rest.map(([s]) => (Math.floor(s / 8) + (s % 8)) % 2)).size === 1;
}

/** [result, reason] if the game is over, else null. seen maps pos.key() to a count over the game. */
export function outcome(pos, seen) {
  if (!pos.legal().length) {
    if (pos.inCheck()) return [pos.turn === "w" ? "0-1" : "1-0", "checkmate"];
    return ["1/2-1/2", "stalemate"];
  }
  if (insufficient(pos.board)) return ["1/2-1/2", "insufficient material"];
  if ((seen[pos.key()] ?? 0) >= 3) return ["1/2-1/2", "threefold repetition"];
  if (pos.half >= 100) return ["1/2-1/2", "50-move rule"];
  return null;
}
