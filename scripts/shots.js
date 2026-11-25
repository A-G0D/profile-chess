// Writes shots/variant-{A,B,C}.svg: one mid-game position, one selected piece, three piece styles.
import { writeFileSync } from "node:fs";
import { newGame } from "../src/game.js";
import { renderSvg } from "../src/render.js";

const s = newGame(7, { v: 3, e: 5, d: 1 });
s.moves = [
  { uci: "e2e4", san: "e4", fen: "" }, { uci: "e7e5", san: "e5", fen: "" },
  { uci: "g1f3", san: "Nf3", fen: "" }, { uci: "b8c6", san: "Nc6", fen: "" },
  { uci: "f1c4", san: "Bc4", fen: "" },
  { uci: "g8f6", san: "Nf6", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
];
s.sel = { sq: 21, ts: 1000 }; // f3 knight
for (const v of "ABC") writeFileSync(new URL(`../shots/variant-${v}.svg`, import.meta.url), renderSvg(s, 1000, v));
