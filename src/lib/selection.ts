/**
 * Paths of every item between `aId` and `bId` inclusive, in list order — the photos
 * covered by a shift-click range from anchor `aId` to the clicked `bId`. Falls back
 * to just `[bId]` if either path isn't in the list. Items are keyed by `path`.
 */
export function rangeIds<T extends { path: string }>(items: T[], aId: string, bId: string): string[] {
  const a = items.findIndex((i) => i.path === aId);
  const b = items.findIndex((i) => i.path === bId);
  if (a < 0 || b < 0) return [bId];
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return items.slice(lo, hi + 1).map((i) => i.path);
}
