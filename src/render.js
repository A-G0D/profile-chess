import { PIECES } from "./pieces.js";
import { W, H } from "./lib.js";
import { CELL, OX, OY, positionOf, liveSel, movesFrom } from "./game.js";

export const PIECE_STYLE = "C"; // A: mono letters, B: unicode glyphs, C: inline SVG set (Cburnett, see NOTICE)

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" };
const xy = (sq) => [OX + (sq % 8) * CELL, OY + (7 - Math.floor(sq / 8)) * CELL];

function piece(p, sq, style) {
  const [x, y] = xy(sq), white = p === p.toUpperCase(), c = x + CELL / 2;
  if (style === "C") return `<use href="#${white ? "w" : "b"}${p.toUpperCase()}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"/>`;
  const fill = white ? "#ffffff" : "#0d1117", stroke = white ? "#0d1117" : "#ffffff";
  if (style === "B")
    return `<text x="${c}" y="${y + 40}" text-anchor="middle" font-size="42" font-family="'Segoe UI Symbol','Apple Symbols','DejaVu Sans',serif" fill="${fill}" stroke="${white ? "#0d1117" : "none"}" stroke-width="1">${GLYPH[p.toLowerCase()]}</text>`;
  return `<text x="${c}" y="${y + 36}" text-anchor="middle" font-size="34" font-weight="700" font-family="${MONO}" fill="${fill}" stroke="${stroke}" stroke-width="0.6" paint-order="stroke">${p}</text>`;
}


export function renderSvg(s, now = Date.now(), style = PIECE_STYLE) {
  const pos = positionOf(s), sel = s.result ? null : liveSel(s, now);
  const targets = sel ? movesFrom(pos, sel.sq).map((m) => m[1]) : [];
  const lastMove = s.moves.length ? s.moves[s.moves.length - 1].uci : "";
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  if (style === "C") {
    o += "<defs>";
    for (const p of new Set(pos.board.filter((q) => q !== "."))) o += `<symbol id="${p === p.toUpperCase() ? "w" : "b"}${p.toUpperCase()}" viewBox="0 0 45 45">${PIECES[p]}</symbol>`;
    o += "</defs>";
  }
  o += `<rect width="${W}" height="${H}" fill="#0d1117"/>`;
  for (let sq = 0; sq < 64; sq++) {
    const [x, y] = xy(sq);
    o += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${(sq + Math.floor(sq / 8)) % 2 ? "#aab4c0" : "#6c7a8c"}"/>`;
  }
  if (sel) { const [x, y] = xy(sel.sq); o += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#e3b341" fill-opacity="0.55"/>`; }
  pos.board.forEach((p, sq) => { if (p !== ".") o += piece(p, sq, style); });
  for (const t of targets) {
    const [x, y] = xy(t), c = [x + CELL / 2, y + CELL / 2];
    o += pos.board[t] === "."
      ? `<circle cx="${c[0]}" cy="${c[1]}" r="8" fill="#0d1117" fill-opacity="0.5"/>`
      : `<circle cx="${c[0]}" cy="${c[1]}" r="21" fill="none" stroke="#0d1117" stroke-opacity="0.5" stroke-width="4"/>`;
  }
  return o + "</svg>\n";
}
