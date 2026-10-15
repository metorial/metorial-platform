import { describe, expect, it } from 'vitest';
import { createFixedRowLayout, createMeasuredRowLayout, getVisibleRows } from './rowLayout';

describe('row layout', () => {
  it('maps offsets to rows at a fixed height', () => {
    let layout = createFixedRowLayout(100, 20);

    expect(layout.totalHeight).toBe(2000);
    expect(layout.offsetOf(5)).toBe(100);
    expect(layout.rowAt(0)).toBe(0);
    expect(layout.rowAt(39)).toBe(1);
    expect(layout.rowAt(5000)).toBe(99);
    expect(layout.rowAt(-10)).toBe(0);
  });

  it('maps offsets to rows of measured heights', () => {
    let layout = createMeasuredRowLayout([20, 40, 20, 60]);

    expect(layout.totalHeight).toBe(140);
    expect([0, 1, 2, 3, 4].map(row => layout.offsetOf(row))).toEqual([0, 20, 60, 80, 140]);
    expect([0, 19, 20, 59, 60, 79, 80, 139, 1000].map(y => layout.rowAt(y))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 3
    ]);
  });

  it('returns the rows inside the viewport plus overscan', () => {
    let layout = createFixedRowLayout(1000, 20);

    expect(getVisibleRows(layout, 2000, 400, 0)).toEqual({ first: 100, last: 120 });
    expect(getVisibleRows(layout, 2000, 400, 100)).toEqual({ first: 95, last: 125 });
    expect(getVisibleRows(createFixedRowLayout(0, 20), 0, 400, 100)).toEqual({
      first: 0,
      last: -1
    });
  });
});
