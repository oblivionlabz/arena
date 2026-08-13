// A model's identity color — decorative wayfinding, not semantic. The
// site's one rule about color (globals.css: "one accent [...] carries
// meaning only — live, running, passed") stays intact: this never touches a
// border, a background, or anything status-bearing, only a small dot next
// to a model's name so a glance can tell rows apart across a long list.
// Deterministic from the slug, so the same model always gets the same hue
// without a lookup table to keep in sync as models are added.
export function modelHue(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 360;
  }
  return hash;
}

/** OKLCH, not hex: perceptually even lightness/chroma across every hue this produces. */
export function modelColor(slug: string): string {
  return `oklch(72% 0.13 ${modelHue(slug)})`;
}

/**
 * For opengraph-image.tsx only. Satori (the renderer behind next/og's
 * ImageResponse) parses CSS with a much smaller function set than a real
 * browser — confirmed live: `oklch()` there throws
 * "Failed to parse declaration", not a silent fallback. This is the same
 * hue as `modelColor()`, converted to a plain hex literal so there's no
 * color function for Satori's parser to not recognize.
 */
export function modelColorHex(slug: string): string {
  const hue = modelHue(slug);
  return hslToHex(hue, 62, 68);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}
