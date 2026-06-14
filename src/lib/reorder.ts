/**
 * Move the item identified by `draggedId` to the slot occupied by `targetId`.
 * Returns a new array, or `null` when the move is a no-op (missing drag id,
 * dropped on itself, or an id not found) so callers can early-return.
 */
export function reorderById<T extends { id: string }>(
  items: T[],
  draggedId: string | null,
  targetId: string,
): T[] | null {
  if (!draggedId || draggedId === targetId) return null;
  const next = [...items];
  const fromIdx = next.findIndex((i) => i.id === draggedId);
  const toIdx = next.findIndex((i) => i.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return null;
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}
