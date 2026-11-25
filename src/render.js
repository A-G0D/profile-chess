import { PIECES } from "./pieces.js";
import { W, H } from "./lib.js";
import { CELL, OX, OY, positionOf, liveSel, movesFrom } from "./game.js";

export const PIECE_STYLE = "C"; // A: mono letters, B: unicode glyphs, C: inline SVG set (Cburnett, see NOTICE)

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" };
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const xy = (sq) => [OX + (sq % 8) * CELL, OY + (7 - Math.floor(sq / 8)) * CELL];

function piece(p, sq, style) {
  const [x, y] = xy(sq), white = p === p.toUpperCase(), c = x + CELL / 2;
  if (style === "C") return `<use href="#${white ? "w" : "b"}${p.toUpperCase()}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"/>`;
  const fill = white ? "#ffffff" : "#0d1117", stroke = white ? "#0d1117" : "#ffffff";
  if (style === "B")
    return `<text x="${c}" y="${y + 40}" text-anchor="middle" font-size="42" font-family="'Segoe UI Symbol','Apple Symbols','DejaVu Sans',serif" fill="${fill}" stroke="${white ? "#0d1117" : "none"}" stroke-width="1">${GLYPH[p.toLowerCase()]}</text>`;
  return `<text x="${c}" y="${y + 36}" text-anchor="middle" font-size="34" font-weight="700" font-family="${MONO}" fill="${fill}" stroke="${stroke}" stroke-width="0.6" paint-order="stroke">${p}</text>`;
}

function status(s) {
  const n = s.moves.length, last = s.moves.slice(-2).map((m) => m.san);
  const no = Math.floor((n - (n % 2 ? 1 : 2)) / 2) + 1; // number of the white move in the last pair
  const lastTxt = n === 0 ? "" : n % 2 ? `${no}. ${last[last.length - 1]}` : `${no}. ${last.join(" ")}`;
  const lines = [];
  if (s.result) {
    lines.push([s.result.r + " " + s.result.reason, "hi"], ["click to start a new game", "mid"]);
  } else lines.push(["your move, white", "hi"], [s.sel ? "click a dot to move" : "click a white piece", "mid"]);
  return { lines, lastTxt };
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
  o += `<rect x="${OX - 0.5}" y="${OY - 0.5}" width="${8 * CELL + 1}" height="${8 * CELL + 1}" fill="none" stroke="#30363d"/>`;
  if (sel) { const [x, y] = xy(sel.sq); o += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#e3b341" fill-opacity="0.55"/>`; }
  for (let i = 0; i < 8; i++) {
    o += `<text x="${OX - 8}" y="${OY + i * CELL + 29}" text-anchor="middle" font-size="11" font-family="${MONO}" fill="#6e7681">${8 - i}</text>`;
    o += `<text x="${OX + i * CELL + CELL / 2}" y="${OY + 8 * CELL + 14}" text-anchor="middle" font-size="11" font-family="${MONO}" fill="#6e7681">${"abcdefgh"[i]}</text>`;
  }
  pos.board.forEach((p, sq) => { if (p !== ".") o += piece(p, sq, style); });
  for (const t of targets) {
    const [x, y] = xy(t), c = [x + CELL / 2, y + CELL / 2];
    o += pos.board[t] === "."
      ? `<circle cx="${c[0]}" cy="${c[1]}" r="8" fill="#0d1117" fill-opacity="0.5"/>`
      : `<circle cx="${c[0]}" cy="${c[1]}" r="21" fill="none" stroke="#0d1117" stroke-opacity="0.5" stroke-width="4"/>`;
  }
  const { lines, lastTxt } = status(s);
  const tx = 470, ink = { hi: "#e6edf3", mid: "#8b949e", lo: "#6e7681" };
  o += `<text x="${tx}" y="60" font-size="13" font-family="${MONO}" fill="${ink.lo}">game ${s.game}</text>`;
  lines.forEach(([t, k], i) => { o += `<text x="${tx}" y="${96 + i * 26}" font-size="${i ? 14 : 18}" font-family="${SANS}" fill="${ink[k]}">${esc(t)}</text>`; });
  if (lastTxt) o += `<text x="${tx}" y="170" font-size="14" font-family="${MONO}" fill="${ink.mid}">last  ${esc(lastTxt)}</text>`;
  o += `<line x1="${tx}" y1="300" x2="${W - 24}" y2="300" stroke="#30363d"/>`;
  const sc = s.score;
  [["visitors", sc.v], ["engine", sc.e], ["draws", sc.d]].forEach(([l, v], i) => {
    o += `<text x="${tx}" y="${332 + i * 26}" font-size="14" font-family="${SANS}" fill="${ink.mid}">${l}</text>`;
    o += `<text x="${W - 24}" y="${332 + i * 26}" text-anchor="end" font-size="14" font-family="${MONO}" fill="${ink.hi}">${v}</text>`;
  });
  return o + "</svg>\n";
}
