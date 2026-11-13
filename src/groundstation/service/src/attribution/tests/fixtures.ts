import mongoose from 'mongoose';
import { vi } from 'vitest';
import {
  remapMergedEntity,
  mergeRemapQueue,
  reattributeManyQueue,
  reattributeSingleQueue,
  reattributionPage,
  type ReattributionJob
} from '../../queues/reattribute';
import { entityService } from '../../services';
import { getStore } from '../../store/connection';
import type { SessionDocument } from '../../store/derivedModels';
import { createTestScope } from '../../test/scope';
import { testDb } from '../../test/setup';
import type { BaseSlice } from '../../facts/write';
import { reattributeSession } from '../session';

export let day = 24 * 60 * 60 * 1000;

export let daysAgo = (days: number) => new Date(Date.now() - days * day);

export let store = getStore();

export let collections = async () => {
  await store.ready();
  return store.collections();
};

// Runs the re-attribution queues inline so a test can assert on their effect.
export let inlineQueues = () => {
  let pending: ReattributionJob[] = [];
  let merges: Parameters<typeof remapMergedEntity>[0][] = [];

  vi.spyOn(reattributeManyQueue, 'add').mockImplementation((async (job: ReattributionJob) => {
    pending.push(job);
  }) as never);
  let mergeAdd = vi.spyOn(mergeRemapQueue, 'add').mockImplementation((async (
    job: Parameters<typeof remapMergedEntity>[0]
  ) => {
    merges.push(job);
  }) as never);

  let singles: { sessionKey: string; organizationId: string }[] = [];

  vi.spyOn(reattributeSingleQueue, 'addManyWithOps').mockImplementation((async (
    jobs: { data: { sessionKey: string; organizationId: string } }[]
  ) => {
    singles.push(...jobs.map(job => job.data));
  }) as never);

  let drain = async () => {
    while (merges.length) await remapMergedEntity(merges.shift()!);

    while (singles.length) await reattributeSession(singles.shift()!);

    while (pending.length) {
      let job = pending.shift()!;
      let page = await reattributionPage(job);

      for (let sessionKey of page.keys) {
        await reattributeSession({ sessionKey, organizationId: job.organizationId });
      }
      if (page.next) pending.push(page.next);
    }
  };

  return { pending, merges, singles, mergeAdd, drain };
};

export let setupScope = async () => {
  let scope = await createTestScope();

  let entity = async (input: Parameters<typeof entityService.upsertEntity>[0]['input']) => {
    let created = await entityService.upsertEntity({
      organization: scope.organization,
      input
    });
    return await testDb.entity.findUniqueOrThrow({ where: { id: created.id } });
  };

  let user = (ref: string, email: string) =>
    entity({
      kind: 'user',
      source: 'metorial.consumer',
      ref,
      identifiers: [{ type: 'email', value: email }]
    });

  let session = async (
    overrides: Partial<Omit<SessionDocument, 'observed' | 'context'>> & {
      observed?: Partial<SessionDocument['observed']>;
      context?: Partial<SessionDocument['context']>;
    } = {}
  ) => {
    let key = crypto.randomUUID().replace(/-/g, '');
    let startedAt = overrides.startedAt ?? daysAgo(1);

    let document: SessionDocument = {
      _id: key,
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      instanceId: scope.instance.id,
      origin: 'native',
      versions: { summary: 1, attribution: 0, facts: 0 },
      client: { family: 'claude-code' },
      rootSessionKey: key,
      lastActivityAt: startedAt,
      lastObservedAt: startedAt,
      state: 'ended',
      expiresAt: new Date(startedAt.getTime() + 400 * day),
      ...overrides,
      startedAt,
      observed: { clientUserIds: [], clientInstallationIds: [], ...overrides.observed },
      context: {
        workspaceIds: [],
        repoIds: [],
        ticketRefs: [],
        tags: [],
        pathStored: false,
        ...overrides.context
      }
    };

    let { sessions } = await collections();
    await sessions.insertOne(document);

    return document;
  };

  let getSession = async (key: string) => {
    let { sessions } = await collections();
    return (await sessions.findOne({ _id: key }))!;
  };

  return { ...scope, entity, user, session, getSession };
};

export let usd = (value: string) => mongoose.Types.Decimal128.fromString(value);

export let slice = (overrides: Partial<BaseSlice> & { bucket: Date }): BaseSlice => ({
  bucketMinutes: 15,
  modelId: 'claude-sonnet-4-5',
  sessionsStarted: 0,
  turns: 1,
  requests: 1,
  failedRequests: 0,
  toolCalls: 0,
  tokens: { inputUncached: 10, cacheRead: 0, cacheWrite: 0, output: 5, reasoning: 0 },
  costReported: [],
  costUsd: usd('1'),
  lines: { added: 0, removed: 0 },
  ...overrides
});

export let entriesOf = (session: SessionDocument, kind: string) =>
  (session.attribution?.entries ?? []).filter(entry => entry.kind == kind);
