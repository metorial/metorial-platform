import { describe, expect, it } from 'vitest';
import { sizesOf } from '../../src/sizing/storeSample';

describe('store sample sizes', () => {
  it('weighs records by the measurement share and counts per session', () => {
    let event = (type: string) => ({ _id: 'e', type, data: { model: 'claude-sonnet-4-5' } });
    let sizes = sizesOf(
      {
        events: [event('model.request'), event('tool.call'), event('tool.call')],
        measurements: [{ _id: 'm', value: 1 }],
        slices: [{ _id: 's', requests: 3 }],
        sessions: [{ _id: 'k', summary: {} }]
      },
      { events: 100, measurements: 25, recordsPerSession: [4, 8], slicesPerSession: [1, 3] }
    );

    expect(sizes.sample).toEqual({
      events: 3,
      measurements: 1,
      sessions: 1,
      slices: 1,
      perSession: 2
    });
    expect(sizes.recordsPerSession).toBe(6 * 1.25);
    expect(sizes.slicesPerSession).toBe(2);
    expect(Object.keys(sizes.bytesPerRecordByType).sort()).toEqual([
      'model.request',
      'tool.call'
    ]);
    expect(sizes.bytesPerRecord).toBeGreaterThan(0);
  });

  it('reports nothing measured for an empty store', () => {
    let sizes = sizesOf(
      { events: [], measurements: [], slices: [], sessions: [] },
      { events: 0, measurements: 0, recordsPerSession: [], slicesPerSession: [] }
    );

    expect(sizes.bytesPerRecord).toBeNull();
    expect(sizes.recordsPerSession).toBeNull();
    expect(sizes.bytesPerSession).toBeNull();
  });
});
