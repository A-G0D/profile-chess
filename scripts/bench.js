// Engine cost per search, cold: one search per fresh node process. Usage: node scripts/bench.js [cap]
import { spawnSync } from "node:child_process";
import { Position } from "../src/chess.js";
import { bestMove, NODE_CAP } from "../src/engine.js";

const FENS = [
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b - - 0 6",
  "r2q1rk1/1b1nbppp/p2ppn2/1p6/3NP3/1BN1BP2/PPPQ2PP/R3R1K1 b - - 0 12",
  "r1bqk2r/pp2bppp/2n1pn2/3p4/3P1B2/2N1PN2/PP3PPP/R2QKB1R b KQkq - 0 7",
  "r4rk1/pp1bqppp/2n1pn2/2bp4/3P1B2/2NBPN2/PPQ2PPP/R4RK1 b - - 5 10",
  "2rq1rk1/pp2bppp/2n1pn2/3p4/3P1B2/P1NBPN2/1P3PPP/R2Q1RK1 b - - 0 11",
  "r1b2rk1/2q1bppp/p1n1pn2/1p1p4/3P1B2/2PBPN2/PP1N1PPP/R2Q1RK1 b - - 0 11",
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 0 1",
  "2r2rk1/1p2qppp/p1n1pn2/q2p4/3P4/P1NBPN2/1PQ2PPP/2R2RK1 b - - 0 15",
  "r2qr1k1/pp1nbppp/2p2n2/3p2B1/3P4/2NBPN2/PP3PPP/R2Q1RK1 b - - 0 12",
];
if (process.argv[2] === "one") {
  const pos = Position.fromFen(FENS[+process.argv[3]]), cap = +process.argv[4];
  const t = process.hrtime.bigint();
  const r = bestMove(pos, 1, 20, {}, cap);
  console.log(JSON.stringify({ ms: Number(process.hrtime.bigint() - t) / 1e6, nodes: r.nodes, depth: r.depth }));
} else if (process.argv[2] === "warm") {
  const cap = +process.argv[3] || NODE_CAP, run = (f) => { const t = process.hrtime.bigint(); const r = bestMove(Position.fromFen(f), 1, 20, {}, cap); return [Number(process.hrtime.bigint() - t) / 1e6, r.nodes]; };
  for (let i = 0; i < 5; i++) FENS.forEach(run);
  let worst = 0, rate = 1e9;
  FENS.forEach((f, i) => { const [ms, n] = run(f); console.log(i, ms.toFixed(2) + " ms", n, "nodes"); worst = Math.max(worst, ms); rate = Math.min(rate, n / ms); });
  console.log(`warm cap ${cap}: worst ${worst.toFixed(2)} ms, nodes/ms min ${rate.toFixed(0)}`);
} else {
  const cap = +process.argv[2] || NODE_CAP;
  let worst = 0, rate = [];
  FENS.forEach((_, i) => {
    const o = JSON.parse(spawnSync(process.execPath, [process.argv[1], "one", i, cap], { encoding: "utf8" }).stdout);
    console.log(i, o.ms.toFixed(2) + " ms", o.nodes, "nodes depth", o.depth);
    worst = Math.max(worst, o.ms); rate.push(o.nodes / o.ms);
  });
  console.log(`cap ${cap}: worst ${worst.toFixed(2)} ms, nodes/ms min ${Math.min(...rate).toFixed(0)}`);
}
