import { describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
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
