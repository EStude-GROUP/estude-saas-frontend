/** Keep the leading filters inline; a collapsed group must contain at least two. */
export function visibleFilterCount(
  availableWidth: number,
  filterWidths: readonly number[],
  searchWidth = 0,
  buttonWidth = 116,
  gap = 12,
): number {
  const count = filterWidths.length;
  if (count < 2) return count;
  const searchCost = searchWidth > 0 ? searchWidth + gap : 0;
  const inlineWidth = filterWidths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, count - 1) * gap;
  if (searchCost + inlineWidth <= availableWidth) return count;

  let visible = count - 2;
  while (visible > 0) {
    const width = filterWidths.slice(0, visible).reduce((sum, value) => sum + value, 0);
    if (searchCost + width + visible * gap + buttonWidth <= availableWidth) break;
    visible -= 1;
  }
  return visible;
}

/** Filter values are primitives or flat records such as a date range. */
export function filterValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]));
}
