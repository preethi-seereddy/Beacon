/** Decorative neon city skyline. Deterministic so server and client render the same markup. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; w: number; h: number; c?: string };

const SHAPES = (() => {
  const r = rng(7);
  const blocks: Rect[] = [];
  const windows: Rect[] = [];
  let x = -6;
  while (x < 390) {
    const w = 28 + Math.floor(r() * 25);
    const h = 50 + Math.floor(r() * 81);
    const y = 230 - h;
    blocks.push({ x, y, w, h });
    for (let wy = y + 10; wy < 222; wy += 11) {
      for (let wx = x + 6; wx < x + w - 5; wx += 9) {
        const q = r();
        const c = q < 0.07 ? "#3DE3A6" : q < 0.13 ? "#E7DD6A" : q < 0.19 ? "#F08CBB" : undefined;
        if (c) windows.push({ x: wx, y: wy, w: 4, h: 5, c });
      }
    }
    x += w + Math.floor(r() * 11) - 4;
  }
  return { blocks, windows };
})();

export function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 390 230" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E36D9B" stopOpacity="0" />
          <stop offset=".55" stopColor="#E36D9B" stopOpacity=".35" />
          <stop offset="1" stopColor="#6B3FA0" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="sky-bd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18213F" />
          <stop offset="1" stopColor="#0B1022" />
        </linearGradient>
      </defs>
      <rect y="60" width="390" height="170" fill="url(#sky-glow)" />
      {SHAPES.blocks.map((b, i) => (
        <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="url(#sky-bd)" stroke="#2B3A6B" strokeWidth=".8" />
      ))}
      {SHAPES.windows.map((w, i) => (
        <rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} rx="1" fill={w.c} opacity=".85" />
      ))}
    </svg>
  );
}
