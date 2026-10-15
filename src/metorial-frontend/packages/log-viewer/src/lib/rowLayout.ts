export interface RowLayout {
  count: number;
  totalHeight: number;
  offsetOf(row: number): number;
  rowAt(offset: number): number;
}

let clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export let createFixedRowLayout = (count: number, rowHeight: number): RowLayout => ({
  count,
  totalHeight: count * rowHeight,
  offsetOf: row => clamp(row, 0, count) * rowHeight,
  rowAt: offset => (count ? clamp(Math.floor(offset / rowHeight), 0, count - 1) : -1)
});

export let createMeasuredRowLayout = (heights: number[]): RowLayout => {
  let count = heights.length;
  let offsets = new Float64Array(count + 1);

  for (let row = 0; row < count; row++) {
    offsets[row + 1] = offsets[row] + heights[row];
  }

  return {
    count,
    totalHeight: offsets[count],
    offsetOf: row => offsets[clamp(row, 0, count)],

    rowAt: offset => {
      if (!count) return -1;

      let low = 0;
      let high = count - 1;

      while (low < high) {
        let mid = (low + high + 1) >> 1;
        if (offsets[mid] <= offset) low = mid;
        else high = mid - 1;
      }

      return low;
    }
  };
};

export let getVisibleRows = (
  layout: RowLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan: number
) => {
  if (!layout.count) return { first: 0, last: -1 };

  return {
    first: layout.rowAt(Math.max(0, scrollTop - overscan)),
    last: layout.rowAt(scrollTop + viewportHeight + overscan)
  };
};
