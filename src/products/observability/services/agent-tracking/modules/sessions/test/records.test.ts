import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { sessionHasMeasurements } from '../src/lib/records';

let filters: Record<string, unknown>[] = [];
let stored: unknown = null;

vi.mock('@mtsrc/agent-tracking-store', () => ({
  defaultStoragePolicy: {},
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      measurements: {
        findOne: async (filter: Record<string, unknown>) => {
          filters.push(filter);
          return stored;
        }
      }
    })
  })
}));

vi.mock('@mtsrc/agent-tracking-module-records', () => ({
  recordReadbackService: { isAvailable: () => false, list: async () => [] },
  toRecordDocument: () => null
}));

let session = {
  _id: 'session-1',
  organizationId: 'ator_1',
  instanceId: 'atin_1',
  startedAt: new Date('2026-03-04T10:00:00Z'),
  lastActivityAt: new Date('2026-03-04T10:30:00Z')
} as SessionDocument;

describe('sessionHasMeasurements', () => {
  beforeEach(() => {
    filters = [];
    stored = null;
  });

  it('looks for a measurement of the session inside its time range', async () => {
    expect(await sessionHasMeasurements(session)).toBe(false);

    expect(filters).toEqual([
      {
        organizationId: 'ator_1',
        instanceId: 'atin_1',
        occurredAt: { $gte: session.startedAt, $lte: session.lastActivityAt },
        'ctx.sessionKey': 'session-1'
      }
    ]);
  });

  it('finds a stored measurement', async () => {
    stored = { _id: 'rec_1' };

    expect(await sessionHasMeasurements(session)).toBe(true);
  });
});
