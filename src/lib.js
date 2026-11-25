export const W = 800, H = 440;

// Returns {x,y} for a raw query string like "?400,200", else null.
export function parseClick(search) {
  const m = /^\??(\d{1,4}),(\d{1,4})$/.exec(search || "");
  if (!m) return null;
  const x = +m[1], y = +m[2];
  return x < W && y < H ? { x, y } : null;
}
