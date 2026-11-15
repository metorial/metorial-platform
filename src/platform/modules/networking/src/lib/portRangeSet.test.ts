import { describe, expect, it } from 'vitest';
import {
  fullPortRange,
  portRangeSetEqualsUniverse,
  portRangeSetIntersect,
  portRangeSetIsEmpty,
  portRangeSetSubtract,
  portRangeSetUnion
} from './portRangeSet';

describe('portRangeSet', () => {
  it('unions overlapping ranges', () => {
    expect(
      portRangeSetUnion([
        { from: 80, to: 80 },
        { from: 81, to: 90 }
      ])
    ).toEqual([{ from: 80, to: 90 }]);
  });

  it('subtracts an inner range', () => {
    expect(portRangeSetSubtract([{ from: 1, to: 100 }], [{ from: 20, to: 30 }])).toEqual([
      { from: 1, to: 19 },
      { from: 31, to: 100 }
    ]);
  });

  it('intersects overlapping ranges', () => {
    expect(portRangeSetIntersect([{ from: 1, to: 100 }], [{ from: 80, to: 200 }])).toEqual([
      { from: 80, to: 100 }
    ]);
  });

  it('detects empty and universe sets', () => {
    expect(portRangeSetIsEmpty([])).toBe(true);
    expect(portRangeSetEqualsUniverse([fullPortRange()])).toBe(true);
    expect(portRangeSetEqualsUniverse([{ from: 443, to: 443 }])).toBe(false);
  });
});
