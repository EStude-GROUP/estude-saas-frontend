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
