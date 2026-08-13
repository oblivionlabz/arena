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
