import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { storeSessionSummary } from '../src/lib/settle';
import { aggregateSession } from '../src/lib/summary';
import { summaryRecord } from './fixtures';

let updates: { filter: unknown; update: Record<string, Record<string, unknown>> }[] = [];

vi.mock('@mtsrc/agent-tracking-store', () => ({
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      sessions: {
        updateOne: async (filter: unknown, update: Record<string, Record<string, unknown>>) =>
          void updates.push({ filter, update })
      }
    })
  })
}));

let session = (overrides: Partial<SessionDocument> = {}) =>
  ({
    _id: 'session-1',
    lastObservedAt: new Date('2026-03-04T10:10:00Z'),
    versions: { summary: 0, attribution: 0, facts: 0 },
    ...overrides
  }) as SessionDocument;

let start = summaryRecord({ type: 'session.start', at: '2026-03-04T10:00:00Z' });

let prompt = summaryRecord({ type: 'prompt.submitted', at: '2026-03-04T10:01:00Z' });

let store = async (d: { session: SessionDocument; records: (typeof start)[] }) =>
  await storeSessionSummary({
    session: d.session,
    aggregate: await aggregateSession({ records: d.records, family: 'codex', catalog: null }),
    watermark: d.session.lastObservedAt
  });

describe('storeSessionSummary', () => {
  beforeEach(() => {
    updates = [];
  });

  it('marks a session in which nothing happened as empty', async () => {
    let stored = await store({ session: session(), records: [start] });

    expect(updates[0]!.update.$set).toMatchObject({ empty: true });
    expect(updates[0]!.update.$unset).not.toHaveProperty('empty');
    expect(stored.empty).toBe(true);
  });

  it('shows an empty session again once a prompt arrived', async () => {
    let stored = await store({ session: session({ empty: true }), records: [start, prompt] });

    expect(updates[0]!.update.$set).not.toHaveProperty('empty');
    expect(updates[0]!.update.$unset).toMatchObject({ empty: '' });
    expect(stored).not.toHaveProperty('empty');
  });
});
