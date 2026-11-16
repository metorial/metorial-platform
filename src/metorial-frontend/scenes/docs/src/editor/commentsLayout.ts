export type RailItem = { id: string; desiredTop: number; height: number };

export let RAIL_CARD_GAP = 8;

export let layoutRailItems = (
  items: RailItem[],
  activeId: string | null,
  gap = RAIL_CARD_GAP
) => {
  let sorted = [...items].sort((a, b) => a.desiredTop - b.desiredTop);
  let tops = new Map<string, number>();
  let activeIndex = sorted.findIndex(item => item.id === activeId);
  let pivot = activeIndex >= 0 ? activeIndex : 0;

  let cursor = -Infinity;
  for (let index = pivot; index < sorted.length; index++) {
    let item = sorted[index]!;
    let top = Math.max(item.desiredTop, cursor);
    tops.set(item.id, top);
    cursor = top + item.height + gap;
  }

  let ceiling = sorted[pivot] ? tops.get(sorted[pivot]!.id)! : Infinity;
  for (let index = pivot - 1; index >= 0; index--) {
    let item = sorted[index]!;
    let top = Math.min(item.desiredTop, ceiling - gap - item.height);
    tops.set(item.id, top);
    ceiling = top;
  }

  return tops;
};
