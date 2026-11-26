import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import { resolveBulkDialect } from '@mtsrc/agent-tracking-dialects';
import { buildMapped, policyWith } from '@mtsrc/agent-tracking-dialects/test/build';
import { toRecordDocument } from '@mtsrc/agent-tracking-module-records';
import { buildSessionSlices } from '@mtsrc/agent-tracking-module-usage';
import { closeRedis } from '@mtsrc/agent-tracking-redis';
import { defaultStoragePolicy, type SessionDocument } from '@mtsrc/agent-tracking-store';
import { aggregateSession } from '../src/lib/summary';
import { createSessionHarness, minutesAfter, store } from './harness';

let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';
let repoId = 'aten_repo_api';

let policy = policyWith({ sessionContext: true });

beforeAll(async () => {
  await store.ready();
});

afterAll(async () => {
  await closeRedis();
});

let desktopRecords = (
  harness: Awaited<ReturnType<typeof createSessionHarness>>,
  sessionId: string,
  observedAt: Date,
  payloads: Record<string, unknown>[]
) => {
  let resolution = resolveBulkDialect('codex', 'envelope', 'metorial.desktop.context.v1');
  if (!resolution.ok) throw new Error('The Desktop dialect did not resolve.');

  let { dialect } = resolution;

  let records = payloads.flatMap(payload => {
    let checked = dialect.check!({ session_id: sessionId, ...payload });
    if (!checked.success) throw new Error('The Desktop payload is not valid.');

    return dialect
      .map(
        { identityHint: '', client: 'codex', policy },
        checked.value as Record<string, unknown>
      )
      .map(entry =>
        buildMapped(entry, {
          principal: harness.principal,
          observedAt,
          itemObservedAt: observedAt
        })
      );
  });

  // The identity stage resolves the repository entity before the session writer runs.
  return records.map(record =>
    record.type == 'session.context'
      ? { ...record, attribution: { ...record.attribution, repo_id: repoId } }
      : record
  );
};

let summaryRecords = (records: NormalizedRecord[], now: Date) =>
  records.map(
    record => toRecordDocument(record, { storage: defaultStoragePolicy, now })!.document
  );

describe('context that arrives after the usage', () => {
  it('attributes the session and its usage slices to the repository, branch and tickets', async () => {
    let harness = await createSessionHarness();
    let sessionId = `conv-${crypto.randomUUID()}`;
    let start = new Date(Date.now() - 60 * 60 * 1000);

    let [usage] = await harness.ingest(
      [
        {
          type: 'model.request',
          at: start,
          sessionId,
          family: 'codex',
          channel: 'otlp.logs',
          data: {
            outcome: 'ok',
            model: { id: 'gpt-5' },
            usage: { input_uncached: 1000, output: 200 }
          }
        }
      ],
      minutesAfter(start, 1)
    );
    let sessionKey = usage!.ctx.session_key!;

    let before = (await harness.session(sessionKey))!;
    expect(before.context.repoIds).toEqual([]);
    expect(before.context.branch).toBeUndefined();

    let contextAt = minutesAfter(start, 5);
    let desktop = desktopRecords(harness, sessionId, contextAt, [
      {
        kind: 'session_context',
        remote_url: 'git@github.com:acme/api.git',
        branch: 'ivan/mt-365-title',
        default_branch: 'main'
      },
      { kind: 'commit', sha, ticket_refs: ['ENG-9', '#42'] }
    ]);
    expect(desktop.every(record => record.ctx.session_key == sessionKey)).toBe(true);

    await harness.ingestRecords(desktop, contextAt);

    let session = (await harness.session(sessionKey)) as SessionDocument;
    expect(session.context).toMatchObject({
      repoIds: [repoId],
      branch: 'ivan/mt-365-title',
      defaultBranch: 'main',
      ticketRefs: ['MT-365', 'ENG-9']
    });

    let now = new Date();
    let aggregate = await aggregateSession({
      records: summaryRecords([usage!, ...desktop], now),
      family: 'codex',
      catalog: null
    });

    expect(aggregate.summary.commitRefs).toEqual([
      { sha, at: contextAt, ticketRefs: ['ENG-9', '#42'] }
    ]);

    let slices = buildSessionSlices({
      session,
      attribution: { entries: [], dimIds: [], version: 1 },
      slices: aggregate.slices,
      now
    });

    expect(slices.length).toBeGreaterThan(0);
    for (let slice of slices) {
      expect(slice).toMatchObject({
        sessionKey,
        repoIds: [repoId],
        branch: 'ivan/mt-365-title',
        ticketRefs: ['MT-365', 'ENG-9']
      });
    }
    expect(slices.reduce((sum, slice) => sum + slice.tokens.output, 0)).toBe(200);
  });
});

describe('Desktop context snapshots', () => {
  it('clears the folder when the session moves back to the repository root, and sets it again', async () => {
    let harness = await createSessionHarness();
    let sessionId = `conv-${crypto.randomUUID()}`;
    let start = new Date(Date.now() - 60 * 60 * 1000);

    let send = async (minutes: number, payload: Record<string, unknown>) => {
      let at = minutesAfter(start, minutes);
      let records = desktopRecords(harness, sessionId, at, [
        { kind: 'session_context', remote_url: 'git@github.com:acme/api.git', ...payload }
      ]);

      await harness.ingestRecords(records, at);

      return records[0]!.ctx.session_key!;
    };

    let sessionKey = await send(1, {
      sub_path: 'services/api',
      permission_mode: 'acceptEdits',
      worktree: true,
      default_branch: 'main'
    });

    expect((await harness.session(sessionKey))!.context).toMatchObject({
      subPath: 'services/api',
      permissionMode: 'acceptEdits',
      worktree: true,
      defaultBranch: 'main'
    });

    await send(2, {});

    let atRoot = (await harness.session(sessionKey))!.context;
    expect(atRoot).not.toHaveProperty('subPath');
    expect(atRoot).not.toHaveProperty('permissionMode');
    expect(atRoot).not.toHaveProperty('worktree');
    expect(atRoot).not.toHaveProperty('defaultBranch');
    expect(atRoot.repoIds).toEqual([repoId]);

    await send(3, { sub_path: 'web' });

    expect((await harness.session(sessionKey))!.context).toMatchObject({ subPath: 'web' });
  });

  it('keeps the folder when context without one arrives from hooks', async () => {
    let harness = await createSessionHarness();
    let sessionId = `conv-${crypto.randomUUID()}`;
    let start = new Date(Date.now() - 60 * 60 * 1000);

    let records = desktopRecords(harness, sessionId, minutesAfter(start, 1), [
      { kind: 'session_context', sub_path: 'services/api', branch: 'main' }
    ]);
    await harness.ingestRecords(records, minutesAfter(start, 1));

    let sessionKey = records[0]!.ctx.session_key!;

    await harness.ingest(
      [
        {
          type: 'session.context',
          at: minutesAfter(start, 2),
          sessionId,
          family: 'codex',
          data: { source: 'hook', branch: 'feature/x' }
        }
      ],
      minutesAfter(start, 2)
    );

    expect((await harness.session(sessionKey))!.context).toMatchObject({
      subPath: 'services/api',
      branch: 'feature/x'
    });
  });
});
