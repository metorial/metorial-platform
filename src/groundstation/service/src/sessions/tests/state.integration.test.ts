import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueSessionSettle } from '../../queues/sessionSettle';
import type { SessionDocument } from '../../store/derivedModels';
import { closeSessionRedis } from '../redis';
import { endIdleSessions, idleSessions, requeueUnsettledSessions } from '../state';
import { store } from './harness';

vi.mock(import('../../queues/sessionSettle'), async importOriginal => ({
  ...(await importOriginal()),
  queueSessionSettle: vi.fn(async () => {})
}));

vi.mock(import('../../classification/trigger'), async importOriginal => ({
  ...(await importOriginal()),
  maybeClassifySession: vi.fn(async () => true)
}));

let { maybeClassifySession } = await import('../../classification/trigger');

let minuteMs = 60 * 1000;
let hourMs = 60 * minuteMs;

let now = new Date();
let ago = (ms: number) => new Date(now.getTime() - ms);

let instanceId = `gin_state_${crypto.randomUUID()}`;

let sessionDoc = (d: {
  key: string;
  state: SessionDocument['state'];
  lastActivityAt: Date;
  settlePending?: boolean;
}): SessionDocument => ({
  _id: d.key,
  organizationId: 'gor_state',
  projectId: 'gpr_state',
  instanceId,
  origin: 'native',
  versions: { summary: 0, attribution: 0, facts: 0 },
  client: { family: 'claude-code' },
  rootSessionKey: d.key,
  startedAt: d.lastActivityAt,
  lastActivityAt: d.lastActivityAt,
  lastObservedAt: d.lastActivityAt,
  state: d.state,
  observed: { clientUserIds: [], clientInstallationIds: [] },
  context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false },
  ...(d.settlePending ? { settlePending: true as const } : {}),
  expiresAt: new Date(now.getTime() + 400 * 24 * hourMs)
});

let key = (name: string) => `${instanceId}:${name}`;

let sessions = () => store.collections().sessions;

let stateOf = async (name: string) => (await sessions().findOne({ _id: key(name) }))?.state;

beforeAll(async () => {
  await store.ready();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await sessions().deleteMany({ instanceId });
});

afterAll(async () => {
  await sessions().deleteMany({ instanceId });
  await closeSessionRedis();
});

describe('session state', () => {
  it('moves inactive sessions to idle and queues their classification', async () => {
    await sessions().insertMany([
      sessionDoc({ key: key('recent'), state: 'active', lastActivityAt: ago(5 * minuteMs) }),
      sessionDoc({ key: key('quiet'), state: 'active', lastActivityAt: ago(31 * minuteMs) })
    ]);

    await idleSessions({ now, limit: 10_000 });

    expect(await stateOf('recent')).toBe('active');
    expect(await stateOf('quiet')).toBe('idle');
    expect(maybeClassifySession).toHaveBeenCalledWith({
      sessionKey: key('quiet'),
      reason: 'idle'
    });
    expect(maybeClassifySession).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionKey: key('recent') })
    );
  });

  it('ends sessions that stayed idle for a day', async () => {
    let lastActivityAt = ago(25 * hourMs);

    await sessions().insertMany([
      sessionDoc({ key: key('idle'), state: 'idle', lastActivityAt: ago(2 * hourMs) }),
      sessionDoc({ key: key('stale'), state: 'idle', lastActivityAt })
    ]);

    await endIdleSessions({ now, limit: 10_000 });

    expect(await stateOf('idle')).toBe('idle');

    let ended = await sessions().findOne({ _id: key('stale') });
    expect(ended?.state).toBe('ended');
    expect(ended?.endedAt).toEqual(lastActivityAt);
  });
});

describe('reconciler', () => {
  it('re-queues recent sessions whose facts are behind their records, page by page', async () => {
    await sessions().insertMany([
      sessionDoc({
        key: key('a'),
        state: 'active',
        lastActivityAt: ago(2 * hourMs),
        settlePending: true
      }),
      sessionDoc({
        key: key('b'),
        state: 'idle',
        lastActivityAt: ago(1 * hourMs),
        settlePending: true
      }),
      sessionDoc({ key: key('settled'), state: 'active', lastActivityAt: ago(hourMs) }),
      sessionDoc({
        key: key('old'),
        state: 'ended',
        lastActivityAt: ago(49 * hourMs),
        settlePending: true
      })
    ]);

    let queued: string[] = [];
    vi.mocked(queueSessionSettle).mockImplementation(async keys => {
      queued.push(...keys.filter(sessionKey => sessionKey.startsWith(instanceId)));
    });

    let cursor: Awaited<ReturnType<typeof requeueUnsettledSessions>>['next'];
    let pages = 0;

    do {
      let page = await requeueUnsettledSessions({ now, limit: 1, cursor });
      cursor = page.next;
      pages++;
    } while (cursor && pages < 10_000);

    expect(queued).toEqual([key('a'), key('b')]);
  });
});
