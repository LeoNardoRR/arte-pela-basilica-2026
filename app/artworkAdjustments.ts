const ARTWORK_ROTATION_CORRECTIONS: Record<number, number> = {
  38: 0.35,
  43: 0.45,
  59: -0.9,
  79: 0.32,
  81: 0.28,
  83: -1.8,
};

export function artworkRotationDegrees(code: string) {
  const slot = Number(code.match(/\d+/)?.[0]);
  return Number.isFinite(slot) ? ARTWORK_ROTATION_CORRECTIONS[slot] ?? 0 : 0;
}
