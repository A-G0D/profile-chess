import test from "node:test";
import assert from "node:assert/strict";
import { newGame, click, hitSquare, rateLimit, positionOf, liveSel, CELL, OX, OY, SEL_MS, GAP_MS, DAY_MAX, DAY_MS } from "../src/game.js";
import { square, Position } from "../src/chess.js";

const T = 1e9;
const at = (t) => square(t);
const s0 = () => newGame(1);

test("hitSquare maps pixels to squares", () => {
  assert.equal(hitSquare(OX + 1, OY + 7 * CELL + 1), at("a1"));
  assert.equal(hitSquare(OX + 4 * CELL + 5, OY + 6 * CELL + 5), at("e2"));
  assert.equal(hitSquare(OX + 8 * CELL, OY), null);
  assert.equal(hitSquare(5, 5), null);
  assert.equal(hitSquare(OX, OY + 8 * CELL), null);
});
test("select a white piece", () => {
  const s = click(s0(), at("e2"), T);
  assert.deepEqual(s.sel, { sq: at("e2"), ts: T });
  assert.equal(s.moves.length, 0);
});
test("click empty, black piece, or off board clears selection", () => {
  const sel = click(s0(), at("e2"), T);
  for (const sq of [at("e5"), at("e7"), null]) assert.equal(click(sel, sq, T + 1).sel, null);
});
test("illegal target clears selection, no move", () => {
  const s = click(click(s0(), at("e2"), T), at("e5"), T + 1);
  assert.equal(s.sel, null);
  assert.equal(s.moves.length, 0);
});
test("legal target plays move and engine replies", () => {
  const s = click(click(s0(), at("e2"), T), at("e4"), T + 1);
  assert.equal(s.moves.length, 2);
  assert.equal(s.moves[0].san, "e4");
  assert.equal(s.sel, null);
  assert.equal(positionOf(s).turn, "w");
});
test("selection can be switched to another piece", () => {
  const s = click(click(s0(), at("e2"), T), at("g1"), T + 1);
  assert.equal(s.sel.sq, at("g1"));
});
test("selection expires after 90 s", () => {
  const sel = click(s0(), at("e2"), T);
  assert.ok(liveSel(sel, T + SEL_MS));
  assert.equal(liveSel(sel, T + SEL_MS + 1000), null);
  const s = click(sel, at("e4"), T + 91000);
  assert.equal(s.moves.length, 0); // expired: e4 is an empty square, not a move
});
test("game over: result recorded once, next click restarts without selecting", () => {
  // fool's mate: white to play and be mated
  let s = s0();
  const play = (a, b, t) => { s = click(click(s, at(a), t), at(b), t + 1); };
  play("f2", "f3", T);
  // force black reply is engine's choice; instead build a finished state directly
  const done = { ...s0(), result: { r: "0-1", reason: "checkmate" }, score: { v: 0, e: 1, d: 0 } };
  const next = click(done, at("e2"), T);
  assert.equal(next.game, 2);
  assert.equal(next.sel, null);
  assert.equal(next.moves.length, 0);
  assert.equal(next.result, null);
  assert.deepEqual(next.score, { v: 0, e: 1, d: 0 });
});
test("mating move ends the game and scores once", () => {
  const fen = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
  const base = { game: 1, moves: [{ uci: "x", san: "x", fen }], sel: null, result: null, score: { v: 0, e: 0, d: 0 } };
  const s = click(click(base, at("a1"), T), at("a8"), T + 1);
  assert.deepEqual(s.result, { r: "1-0", reason: "checkmate" });
  assert.equal(s.score.v, 1);
  assert.equal(s.moves.length, 2); // no engine reply after mate
  const again = click(s, at("a1"), T + 5);
  assert.equal(again.score.v, 1);
});
test("rate limit: 3 s gap and daily cap", () => {
  const r1 = rateLimit(undefined, T);
  assert.deepEqual(r1, { last: T, day_start: T, n: 1 });
  assert.equal(rateLimit(r1, T + GAP_MS - 1), null);
  assert.equal(rateLimit(r1, T + GAP_MS).n, 2);
  assert.equal(rateLimit({ last: 0, day_start: T, n: DAY_MAX }, T + 10 * GAP_MS), null);
  assert.deepEqual(rateLimit({ last: 0, day_start: T, n: DAY_MAX }, T + DAY_MS), { last: T + DAY_MS, day_start: T + DAY_MS, n: 1 });
});

test("cold path: first engine reply in a fresh isolate is capped at COLD_CAP, later ones at NODE_CAP", async () => {
  const { bestMove, resetWarm, COLD_CAP, NODE_CAP } = await import("../src/engine.js");
  const pos = Position.fromFen("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4");
  resetWarm();
  const a = bestMove(pos, 1, 20), b = bestMove(pos, 1, 20);
  assert.ok(a.nodes <= COLD_CAP + 1 && a.move);
  assert.ok(b.nodes > COLD_CAP && b.nodes <= NODE_CAP + 1);
});
