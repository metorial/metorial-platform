import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedRecord, RecordRole } from '@mtsrc/agent-tracking-spec';
import {
  buildDraft,
  unitOrganizationKey,
  unitPrincipal
} from '@mtsrc/agent-tracking-dialects/test/build';
import type { StoreCollections } from '@mtsrc/agent-tracking-store';
import { assignSessions } from '../src/lib/assign';

let cache = vi.hoisted(() => new Map<string, string>());

vi.mock('@mtsrc/agent-tracking-redis', () => ({
  redisKey: (...parts: string[]) => parts.join(':'),
  tryRedis: async (operation: (redis: unknown) => Promise<unknown>) =>
    operation({
      get: async (key: string) => cache.get(key) ?? null,
      mget: async (keys: string[]) => keys.map(key => cache.get(key) ?? null)
    })
}));

let principal = unitPrincipal();
let start = new Date('2026-11-25T22:49:29Z');
let device = 'aten_device';

let collections = {
  sessions: { findOne: async () => null },
  events: { find: () => ({ toArray: async () => [] }) },
  sessionLinks: { find: () => ({ toArray: async () => [] }) }
} as unknown as StoreCollections;

let secondsAfter = (seconds: number) => new Date(start.getTime() + seconds * 1000);

let record = (d: {
  seconds: number;
  role?: RecordRole;
  sessionId?: string;
  traceId?: string;
}) => {
  let built = buildDraft(
    {
      kind: 'event',
      type: 'model.request',
      identity: crypto.randomUUID(),
      occurredAt: secondsAfter(d.seconds),
      client: { family: 'codex' },
      ...(d.role ? { role: d.role } : {}),
      ctx: {
        ...(d.sessionId ? { sessionId: d.sessionId } : {}),
        ...(d.traceId ? { trace: { traceId: d.traceId } } : {})
      }
    },
    { principal },
    { adapter: 'codex', dialect: 'codex.otlp.v1', channel: 'otlp.logs' }
  );

  return { ...built, attribution: { ...built.attribution, device_id: device } };
};

let housekeeping = (seconds: number) => record({ seconds, role: 'supplemental' });

let inferKey = `${principal.instance.id}:codex:${device}`;

let cacheState = (d: { sessionKey: string; from: number; to: number }) =>
  cache.set(
    `infer:${inferKey}`,
    JSON.stringify({
      sessionKey: d.sessionKey,
      startedAt: secondsAfter(d.from),
      lastActivityAt: secondsAfter(d.to)
    })
  );

let assign = (records: NormalizedRecord[]) =>
  assignSessions({
    principal,
    organizationKey: unitOrganizationKey(principal),
    records,
    collections
  });

describe('inferred sessions', () => {
  beforeEach(() => cache.clear());

  it('leaves housekeeping records without a session id out of sessions', async () => {
    let models = [housekeeping(0), housekeeping(23)];
    let conversation = record({ seconds: 1, sessionId: 'conversation-1' });

    let assignment = await assign([...models, conversation]);

    expect(models.map(entry => entry.ctx.session_key)).toEqual([undefined, undefined]);
    expect(conversation.ctx.session_origin).toBe('native');
    expect(assignment.inferKeys.size).toBe(0);
    expect(assignment.inferred.size).toBe(0);
  });

  it('opens one session for primaries out of order, joining only housekeeping inside it', async () => {
    let late = record({ seconds: 10 });
    let early = record({ seconds: 0 });
    let before = housekeeping(-3);
    let inside = housekeeping(5);
    let after = housekeeping(20);

    let assignment = await assign([after, late, inside, before, early]);

    let sessionKey = early.ctx.session_key;
    expect(sessionKey).toBeDefined();
    expect(late.ctx.session_key).toBe(sessionKey);
    expect(inside.ctx).toMatchObject({ session_key: sessionKey, session_origin: 'inferred' });
    expect(before.ctx.session_key).toBeUndefined();
    expect(after.ctx.session_key).toBeUndefined();
    expect(assignment.inferred.get(inferKey)).toEqual({
      sessionKey,
      startedAt: secondsAfter(0),
      lastActivityAt: secondsAfter(10)
    });
  });

  it('joins housekeeping to a cached session from an earlier batch', async () => {
    cacheState({ sessionKey: 'sk_cached', from: 0, to: 60 });

    let inside = housekeeping(30);
    let assignment = await assign([inside]);

    expect(inside.ctx).toMatchObject({ session_key: 'sk_cached', session_origin: 'inferred' });
    expect(assignment.inferKeys.get('sk_cached')).toBe(inferKey);
  });

  it('does not extend a cached session’s window with housekeeping', async () => {
    cacheState({ sessionKey: 'sk_cached', from: 0, to: 60 });

    let before = housekeeping(-30);
    let after = housekeeping(90);
    let assignment = await assign([after, before]);

    expect(before.ctx.session_key).toBeUndefined();
    expect(after.ctx.session_key).toBeUndefined();
    expect(assignment.inferKeys.size).toBe(0);
    expect(assignment.inferred.get(inferKey)).toEqual({
      sessionKey: 'sk_cached',
      startedAt: secondsAfter(0),
      lastActivityAt: secondsAfter(60)
    });

    let primary = record({ seconds: 90 });
    await assign([primary]);

    expect(primary.ctx.session_key).toBe('sk_cached');
  });
});

describe('linked sessions', () => {
  let zeroTrace = '0'.repeat(32);
  let realTrace = '4bf92f3577b34da6a3ce929d0e0e4736';

  beforeEach(() => cache.clear());

  it('links a record without a session id to the session that shares its trace', async () => {
    let native = record({ seconds: 0, sessionId: 'thread-1', traceId: realTrace });
    let stray = record({ seconds: 5, role: 'supplemental', traceId: realTrace });

    await assign([native, stray]);

    expect(stray.ctx).toMatchObject({
      session_key: native.ctx.session_key,
      session_origin: 'linked'
    });
  });

  it('never links through an all-zero trace id', async () => {
    let native = record({ seconds: 0, sessionId: 'thread-1', traceId: zeroTrace });
    let stray = record({ seconds: 5, role: 'supplemental', traceId: zeroTrace });

    await assign([native, stray]);

    expect(stray.ctx.session_key).toBeUndefined();
  });

  it('ignores a link stored earlier for the all-zero trace id', async () => {
    cache.set(`corr:${principal.instance.id}:trace:${zeroTrace}`, 'sk_claimed');

    let stray = record({ seconds: 5, role: 'supplemental', traceId: zeroTrace });
    await assign([stray]);

    expect(stray.ctx.session_key).toBeUndefined();
  });
});
