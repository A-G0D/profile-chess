# profile-chess

A Cloudflare Worker that serves a shared chess board as an SVG on a GitHub profile: visitors click the image to play white against a small engine.

## Quickstart

```
npm test                      # node --test, 22 tests
npx wrangler@4.20.0 dev       # local Worker and Durable Object
scripts/proof.sh              # plays three moves through /click, saves SVGs and PNGs to shots/
```

Embed it as a server-side image map:

```html
<a href="https://YOUR-WORKER.workers.dev/click"><img src="https://YOUR-WORKER.workers.dev/canvas.svg" width="800" ismap></a>
```

## How it works

- `ismap`: a link wrapping an `<img ismap>` makes the browser request `/click?x,y`, with the pixel offset inside the image. The Worker maps that to a square, applies the move and answers 302 to the profile. The image must display at its natural 800 px width or the coordinates do not line up with the board.
- camo: GitHub serves README images through its camo proxy, so the visitor's browser never talks to the Worker for the picture. The click is a normal navigation to the Worker, which is why it can carry coordinates and a rate-limit key.
- Durable Object: one SQLite-backed object holds the game, the shared selection, the score and the rate-limit table `rl`. Every request goes through it, so clicks are serialised.
- Flow: clicking a white piece stores it as the selection for 90 s and the board shows it highlighted with dots on its legal targets. Clicking a dot plays the move (promotion is always a queen) and the engine replies in the same request. Any other click clears the selection. After mate, stalemate, the 50-move rule, threefold repetition or insufficient material, the status line shows the result and the next click starts a new game. Score is counted from finished games: visitors, engine, draws.
- Rate limit: per IP hash, 3 s between clicks and 300 per day.
- Routes: `GET /canvas.svg`, `GET /click?x,y`, `POST /admin/reset` (new game), `POST /admin/rollback?plies=N` (undo the last N plies). Both admin routes need the `X-Admin-Token` header.
- Old `cells` and `log` tables from the pixel canvas are kept and no longer rendered.

Piece style is the constant `PIECE_STYLE` in `src/render.js`: `A` monospace letters, `B` Unicode glyphs, `C` inline SVG pieces (default). A and B depend on the fonts of the viewer's machine; C does not.

## Engine and CPU budget

Negamax with alpha-beta, quiescence, material plus piece-square tables, depth up to 3. Workers Free allows 10 ms CPU per request ([limits](https://developers.cloudflare.com/workers/platform/limits/)), and clocks do not advance inside a Worker, so the search is capped by node count (`NODE_CAP = 1000` in `src/engine.js`). Durable Objects have a looser default limit of 30 s CPU ([limits](https://developers.cloudflare.com/durable-objects/platform/limits/)), so the 10 ms target is conservative.

Measured with `node scripts/bench.js` on 10 middlegame positions, Node 22 on one laptop:

| Cap (nodes) | Warm worst case | Cold process worst case |
|---|---|---|
| 50 (`COLD_CAP`) | not run | 3.1 to 3.4 ms (3 runs) |
| 1000 | 4 to 5 ms | 13 to 29 ms |
| 2000 | 8 ms | not run |
| 3000 | 15.5 ms | not run |
| 6000 | 21.7 ms | 93 ms |

Warm is after five passes in one process, at least 246 nodes/ms. Cold is a fresh process per position and is dominated by JIT warm-up. Node timings are not Workers CPU time, The first search in a fresh isolate uses `COLD_CAP = 50`, later ones use `NODE_CAP`. Cold Node numbers still exclude Workers startup.

## Limits

- One shared game and one shared selection: two visitors can overwrite each other's selection.
- The engine is weak by design (about 1000 nodes per move).
- Rate limiting keys on a hash of the client IP, so visitors behind one address share a quota.
- Promotion is queen only.
- Not deployed by this repo's scripts.

## License

MIT, see `LICENSE`. Chess piece artwork by Colin M. L. Burnett, used under BSD 3-Clause, see `NOTICE`.
