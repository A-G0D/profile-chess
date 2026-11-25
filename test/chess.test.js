import test from "node:test";
import assert from "node:assert/strict";
import { Position, START, perft, outcome, square, uci } from "../src/chess.js";
import { bestMove } from "../src/engine.js";

const P = (f) => Position.fromFen(f);
const KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const POS3 = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const mv = (pos, t) => pos.legal().find((m) => uci(m) === t);

test("perft start", () => {
  assert.deepEqual([1, 2, 3].map((d) => perft(P(START), d)), [20, 400, 8902]);
});
test("perft kiwipete", () => {
  assert.deepEqual([1, 2].map((d) => perft(P(KIWI), d)), [48, 2039]);
});
test("perft position 3", () => {
  assert.deepEqual([1, 2, 3].map((d) => perft(P(POS3), d)), [14, 191, 2812]);
});
test("fen round trip", () => {
  for (const f of [START, KIWI, POS3, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"]) assert.equal(P(f).fen(), f);
});
test("san", () => {
  const castle = P("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(castle.san(mv(castle, "e1g1")), "O-O");
  assert.equal(castle.san(mv(castle, "e1c1")), "O-O-O");
  const promo = P("8/P6k/8/8/8/8/8/K7 w - - 0 1");
  assert.equal(promo.san(mv(promo, "a7a8q")), "a8=Q");
  const dis = P("4k3/8/8/8/8/8/4K3/R6R w - - 0 1");
  assert.equal(dis.san(mv(dis, "a1d1")), "Rad1");
  const mate = P("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(mate.san(mv(mate, "a1a8")), "Ra8#");
});
test("outcomes", () => {
  const o = (f, seen = {}) => outcome(P(f), seen)?.[1];
  assert.equal(o("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"), "checkmate");
  assert.equal(o("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), "stalemate");
  assert.equal(o("8/8/8/4k3/8/3K4/8/8 w - - 0 1"), "insufficient material");
  assert.equal(o("8/8/8/4k3/8/3K4/8/R7 w - - 100 80"), "50-move rule");
  const p = P("8/8/8/4k3/8/3K4/8/R7 w - - 4 80");
  assert.equal(outcome(p, { [p.key()]: 3 })[1], "threefold repetition");
  assert.equal(o(START), undefined);
});
test("engine: tiny cap still returns a legal move, deterministic", () => {
  const pos = P(KIWI);
  const a = bestMove(pos, 1, 20, {}, 10), b = bestMove(pos, 1, 20, {}, 10);
  assert.ok(mv(pos, uci(a.move)));
  assert.deepEqual(a, b);
});
test("engine: finds mate in one under the default cap", () => {
  const pos = P("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1");
  assert.equal(uci(bestMove(pos, 1, 40).move), "a8a1");
});
test("engine: null when no legal move", () => {
  assert.equal(bestMove(P("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"), 1, 1), null);
});
