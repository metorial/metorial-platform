import { describe, expect, it } from 'vitest';
import type { NormalizedRecord, RecordRole } from '@mtsrc/agent-tracking-spec';
import { resolveBulkDialect } from '@mtsrc/agent-tracking-dialects';
import {
  buildDraft,
  buildMapped,
  policyWith,
  unitPrincipal
} from '@mtsrc/agent-tracking-dialects/test/build';
import type { StoreCollections } from '@mtsrc/agent-tracking-store';
import { writeSessions } from '../src/lib/write';

let principal = unitPrincipal();
let now = new Date('2026-06-15T12:00:00Z');

let policy = policyWith({ sessionContext: true, sessionTitles: true });

type Op = {
  updateOne: {
    filter: Record<string, unknown>;
    update: Record<string, Record<string, unknown>>;
    upsert?: boolean;
  };
};

let desktopContext = (payload: Record<string, unknown>, observedAt: string) => {
  let resolution = resolveBulkDialect('codex', 'envelope', 'metorial.desktop.context.v1');
  if (!resolution.ok) throw new Error('The Desktop dialect did not resolve.');

  let checked = resolution.dialect.check!({
    kind: 'session_context',
    session_id: 'conv-1',
    ...payload
  });
  if (!checked.success) throw new Error('The Desktop payload is not valid.');

  return resolution.dialect
    .map(
      { identityHint: '', client: 'codex', policy },
      checked.value as Record<string, unknown>
    )
    .map(entry => buildMapped(entry, { principal, itemObservedAt: new Date(observedAt) }));
};

let hookContext = (data: Record<string, unknown>) =>
  buildDraft(
    {
      kind: 'event',
      type: 'session.context',
      identity: 'hook-context',
      occurredAt: new Date('2026-06-15T11:58:00Z'),
      client: { family: 'codex' },
      ctx: { sessionId: 'conv-1' },
      data: { source: 'hook', ...data }
    },
    { principal }
  );

let sessionOps = async (records: NormalizedRecord[]) => {
  let ops: Op[] = [];

  let collections = {
    sessions: {
      find: () => ({ toArray: async () => [] }),
      bulkWrite: async (written: Op[]) => void ops.push(...written)
    },
    sessionLinks: { bulkWrite: async () => undefined },
    sourceHealth: { bulkWrite: async () => undefined }
  } as unknown as StoreCollections;

  await writeSessions({
    principal,
    records,
    observedAt: now,
    assignment: { inferKeys: new Map(), inferred: new Map() },
    collections
  });

  return ops;
};

let upsertOf = (ops: Op[]) => ops.find(op => op.updateOne.upsert)!.updateOne.update;

let full = {
  remote_url: 'git@github.com:acme/api.git',
  branch: 'main',
  default_branch: 'main',
  worktree: true,
  sub_path: 'services/api',
  permission_mode: 'acceptEdits',
  title: 'Fix login'
};

describe('writeSessions with Desktop context', () => {
  it('sets every field the newest Desktop context carries', async () => {
    let update = upsertOf(await sessionOps(desktopContext(full, '2026-06-15T11:55:00Z')));

    expect(update.$set).toMatchObject({
      'context.defaultBranch': 'main',
      'context.worktree': true,
      'context.subPath': 'services/api',
      'context.permissionMode': 'acceptEdits',
      'context.title': 'Fix login'
    });
    expect(update.$unset).toBeUndefined();
  });

  it('clears the folder and the other snapshot fields the newest Desktop context leaves out', async () => {
    let update = upsertOf(
      await sessionOps([
        ...desktopContext(full, '2026-06-15T11:50:00Z'),
        ...desktopContext(
          { remote_url: full.remote_url, branch: 'main' },
          '2026-06-15T11:55:00Z'
        )
      ])
    );

    expect(update.$unset).toEqual({
      'context.defaultBranch': '',
      'context.worktree': '',
      'context.subPath': '',
      'context.permissionMode': ''
    });
    expect(update.$set).not.toHaveProperty('context.subPath');
    expect(update.$set).toMatchObject({ 'context.title': 'Fix login' });
  });

  it('never clears fields for context from hooks or OTel', async () => {
    let update = upsertOf(await sessionOps([hookContext({ branch: 'main' })]));

    expect(update.$unset).toBeUndefined();
    expect(update.$set).toMatchObject({ 'context.branch': 'main' });
  });
});

describe('writeSessions repository ids', () => {
  it('adds at most 16 repositories per session and trims the stored list', async () => {
    let records = Array.from({ length: 20 }, (_, index) => {
      let record = hookContext({ branch: `b-${index}` });

      return {
        ...record,
        id: `rec-${index}`,
        attribution: { ...record.attribution, repo_id: `aten_repo_${index}` }
      };
    });

    let ops = await sessionOps(records);
    let added = upsertOf(ops).$addToSet!['context.repoIds'] as { $each: string[] };

    expect(added.$each).toHaveLength(16);
    expect(ops).toContainEqual({
      updateOne: {
        filter: { _id: records[0]!.ctx.session_key, 'context.repoIds.16': { $exists: true } },
        update: { $push: { 'context.repoIds': { $each: [], $slice: 16 } } }
      }
    });
  });
});

describe('writeSessions time bounds', () => {
  let event = (d: {
    id: string;
    type?: string;
    at: string;
    linked?: boolean;
    role?: RecordRole;
  }) => {
    let record = buildDraft(
      {
        kind: 'event',
        type: d.type ?? 'model.request',
        role: d.role ?? (d.linked ? 'supplemental' : 'primary'),
        identity: d.id,
        occurredAt: new Date(d.at),
        client: { family: 'codex' },
        ctx: { sessionId: 'conv-1' },
        data: {}
      },
      { principal }
    );

    record.ctx.session_origin = d.linked ? 'linked' : 'native';

    return record;
  };

  it('takes the start and last activity from its own records and linked housekeeping not', async () => {
    let update = upsertOf(
      await sessionOps([
        event({ id: 'linked-early', at: '2026-06-15T09:40:00Z', linked: true }),
        event({ id: 'own-start', type: 'session.start', at: '2026-06-15T10:00:00Z' }),
        event({ id: 'own-prompt', type: 'prompt.submitted', at: '2026-06-15T10:05:00Z' }),
        event({ id: 'linked-late', at: '2026-06-15T10:30:00Z', linked: true })
      ])
    );

    expect(update.$min).toMatchObject({ startedAt: new Date('2026-06-15T10:00:00Z') });
    expect(update.$max).toEqual({
      lastActivityAt: new Date('2026-06-15T10:05:00Z'),
      lastObservedAt: now
    });
  });

  it('never moves the bounds or the state of a session for linked housekeeping alone', async () => {
    let ops = await sessionOps([
      event({ id: 'linked-1', at: '2026-06-15T09:40:00Z', linked: true }),
      event({ id: 'linked-2', type: 'session.end', at: '2026-06-15T11:10:00Z', linked: true })
    ]);
    let update = upsertOf(ops);

    expect(update.$min).toBeUndefined();
    expect(update.$max).toEqual({ lastObservedAt: now });
    expect(update.$setOnInsert).toMatchObject({
      startedAt: new Date('2026-06-15T09:40:00Z'),
      lastActivityAt: new Date('2026-06-15T11:10:00Z'),
      expiresAt: expect.any(Date)
    });
    expect(ops.filter(op => !op.updateOne.upsert)).toEqual([]);
  });

  it('moves the bounds for linked primary spans of a GenAI app around its root span', async () => {
    let update = upsertOf(
      await sessionOps([
        event({ id: 'chat-1', at: '2026-06-15T09:58:00Z', linked: true, role: 'primary' }),
        event({ id: 'root', type: 'agent.start', at: '2026-06-15T10:00:00Z' }),
        event({
          id: 'tool-1',
          type: 'tool.call',
          at: '2026-06-15T10:07:00Z',
          linked: true,
          role: 'primary'
        })
      ])
    );

    expect(update.$min).toMatchObject({ startedAt: new Date('2026-06-15T09:58:00Z') });
    expect(update.$max).toEqual({
      lastActivityAt: new Date('2026-06-15T10:07:00Z'),
      lastObservedAt: now
    });
  });

  it('wakes a session for a linked primary record alone', async () => {
    let ops = await sessionOps([
      event({ id: 'chat-2', at: '2026-06-15T11:00:00Z', linked: true, role: 'primary' })
    ]);
    let update = upsertOf(ops);

    expect(update.$min).toMatchObject({ startedAt: new Date('2026-06-15T11:00:00Z') });
    expect(ops.filter(op => !op.updateOne.upsert)).toEqual([
      {
        updateOne: {
          filter: { _id: expect.any(String), state: 'idle' },
          update: { $set: { state: 'active' } }
        }
      }
    ]);
  });

  it('does not end a session on a linked end record', async () => {
    let ops = await sessionOps([
      event({ id: 'own-start', type: 'session.start', at: '2026-06-15T10:00:00Z' }),
      event({
        id: 'linked-end',
        type: 'session.end',
        at: '2026-06-15T10:30:00Z',
        linked: true
      })
    ]);

    expect(ops.filter(op => !op.updateOne.upsert)).toEqual([
      {
        updateOne: {
          filter: { _id: expect.any(String), state: { $ne: 'active' } },
          update: { $set: { state: 'active' }, $unset: { endedAt: '' } }
        }
      }
    ]);
  });
});

describe('writeSessions correlation links', () => {
  let linkOps = async (traceId: string) => {
    let ops: Op[] = [];

    let record = buildDraft(
      {
        kind: 'event',
        type: 'session.start',
        identity: `start-${traceId}`,
        occurredAt: new Date('2026-06-15T10:00:00Z'),
        client: { family: 'codex' },
        ctx: { sessionId: 'conv-1', trace: { traceId } },
        data: {}
      },
      { principal }
    );
    record.ctx.session_origin = 'native';

    let collections = {
      sessions: {
        find: () => ({ toArray: async () => [] }),
        bulkWrite: async () => undefined
      },
      sessionLinks: { bulkWrite: async (written: Op[]) => void ops.push(...written) },
      sourceHealth: { bulkWrite: async () => undefined }
    } as unknown as StoreCollections;

    await writeSessions({
      principal,
      records: [record],
      observedAt: now,
      assignment: { inferKeys: new Map(), inferred: new Map() },
      collections
    });

    return ops.map(op => op.updateOne.filter._id);
  };

  it('lets the first native record claim its trace, but never an all-zero one', async () => {
    let trace = '4bf92f3577b34da6a3ce929d0e0e4736';

    expect(await linkOps(trace)).toEqual([`${principal.instance.id}:trace:${trace}`]);
    expect(await linkOps('0'.repeat(32))).toEqual([]);
  });
});
