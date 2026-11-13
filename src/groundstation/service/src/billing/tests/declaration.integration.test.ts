import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getId } from '../../id';
import { queuePriceOverrideImpact } from '../../knowledge/impact';
import { resetKnowledgeCache } from '../../knowledge/cache';
import { syncKnowledge } from '../../knowledge/ingest';
import {
  knowledgeCatalog,
  startKnowledgeServer,
  type KnowledgeFixtureServer
} from '../../knowledge/tests/fixture';
import { knowledgeVersionKey } from '../../knowledge/version';
import { getOrganizationPricing, resetOverrideCache } from '../../pricing/cache';
import { closeSessionRedis, getSessionRedis } from '../../sessions/redis';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import { billingDeclarationService } from '../declaration';

vi.mock('../../knowledge/impact', () => ({
  queuePriceOverrideImpact: vi.fn(async () => {})
}));

let hourMs = 60 * 60 * 1000;

let server: KnowledgeFixtureServer;

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let impactCalls = () => vi.mocked(queuePriceOverrideImpact).mock.calls.map(([call]) => call);

let errorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code;
  }

  return undefined;
};

let createEntity = (
  organizationOid: bigint,
  input: {
    kind?: string;
    status?: 'managed' | 'merged' | 'archived';
    mergedIntoOid?: bigint;
  } = {}
) =>
  testDb.entity.create({
    data: {
      ...getId('entity'),
      kind: input.kind ?? 'user',
      status: input.status ?? 'managed',
      mergedIntoOid: input.mergedIntoOid ?? null,
      ...(input.status == 'archived' ? { archivedAt: new Date() } : {}),
      organizationOid
    }
  });

describe('billing declarations', () => {
  beforeAll(async () => {
    server = await startKnowledgeServer();
  });

  afterAll(async () => {
    await server.close();
    await closeSessionRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await getSessionRedis().del(knowledgeVersionKey);
    resetKnowledgeCache();
    resetOverrideCache();
    vi.mocked(queuePriceOverrideImpact).mockClear();

    server.publish(knowledgeCatalog({ generatedAt: hoursAgo(72).toISOString() }), 'fp-1');
    let result = await syncKnowledge({ url: server.url, guardrails: false });
    expect(result.status).toBe('applied');
  });

  it('creates, reads, lists, updates and archives declarations with their impact scopes', async () => {
    let { organization, project } = await createTestScope();
    let user = await createEntity(organization.oid);

    let created = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: {
        name: 'Claude Max seats',
        projectId: project.ref,
        userId: user.id,
        agentId: 'claude-code',
        mode: 'included',
        plan: '  max  ',
        createdBy: 'usr_1',
        validFrom: hoursAgo(48)
      }
    });

    expect(created.id).toMatch(/^gbd_/);
    let row = await testDb.billingDeclaration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({
      organizationOid: organization.oid,
      projectOid: project.oid,
      userOid: user.oid,
      agentId: 'claude-code',
      mode: 'included',
      plan: 'max',
      createdBy: 'usr_1',
      archivedAt: null
    });
    expect(impactCalls()).toEqual([
      {
        organizationOid: organization.oid,
        projectOid: project.oid,
        before: null,
        after: {
          target: 'agent',
          targetId: 'claude-code',
          vendorId: null,
          validFrom: created.validFrom,
          validTo: null
        }
      }
    ]);

    let fetched = await billingDeclarationService.getBillingDeclarationById({
      organization,
      billingDeclarationId: created.id
    });
    expect(fetched).toMatchObject({ project: { id: project.id }, user: { id: user.id } });

    let renamed = await billingDeclarationService.updateBillingDeclaration({
      organization,
      billingDeclaration: fetched,
      input: { name: 'Renamed', reason: 'seat audit' }
    });
    expect(renamed).toMatchObject({ name: 'Renamed', reason: 'seat audit', plan: 'max' });
    expect(impactCalls()).toHaveLength(1);

    let validTo = new Date();
    let changed = await billingDeclarationService.updateBillingDeclaration({
      organization,
      billingDeclaration: renamed,
      input: { agentId: null, mode: 'api', plan: '', projectId: null, userId: null, validTo }
    });
    expect(changed).toMatchObject({
      agentId: null,
      mode: 'api',
      plan: null,
      projectOid: null,
      userOid: null,
      validTo
    });
    expect(impactCalls()[1]).toEqual({
      organizationOid: organization.oid,
      projectOid: null,
      before: {
        target: 'agent',
        targetId: 'claude-code',
        vendorId: null,
        validFrom: created.validFrom,
        validTo: null
      },
      after: {
        target: 'all',
        targetId: null,
        vendorId: null,
        validFrom: created.validFrom,
        validTo
      }
    });

    let other = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'Overage', mode: 'overage', userId: user.id }
    });

    let list = async (d: Record<string, unknown> = {}) =>
      (
        await (
          await billingDeclarationService.listBillingDeclarations({ organization, ...d })
        ).run({ limit: 10 })
      ).items.map(item => item.id);

    expect((await list()).sort()).toEqual([changed.id, other.id].sort());
    expect(await list({ modes: ['overage'] })).toEqual([other.id]);
    expect(await list({ userIds: [user.id] })).toEqual([other.id]);
    expect(await list({ agentIds: ['claude-code'] })).toEqual([]);
    expect(await list({ projectIds: [] })).toEqual([]);

    let archived = await billingDeclarationService.archiveBillingDeclaration({
      organization,
      billingDeclaration: changed
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(impactCalls()[3]).toMatchObject({ before: { target: 'all' }, after: null });

    let again = await billingDeclarationService.archiveBillingDeclaration({
      organization,
      billingDeclaration: archived
    });
    expect(again.archivedAt).toEqual(archived.archivedAt);
    expect(impactCalls()).toHaveLength(4);

    expect(await list()).toEqual([other.id]);
    expect((await list({ includeArchived: true })).sort()).toEqual(
      [changed.id, other.id].sort()
    );

    expect(
      await errorCode(
        billingDeclarationService.updateBillingDeclaration({
          organization,
          billingDeclaration: archived,
          input: { name: 'Again' }
        })
      )
    ).toBe('bad_request');
  });

  it('rejects invalid declarations and keeps organizations apart', async () => {
    let { organization } = await createTestScope();
    let other = await createTestScope();

    let team = await createEntity(organization.oid, { kind: 'team' });
    let archivedUser = await createEntity(organization.oid, { status: 'archived' });
    let foreignUser = await createEntity(other.organization.oid);

    let create = (input: Record<string, unknown>) =>
      errorCode(
        billingDeclarationService.createBillingDeclaration({
          organization,
          input: { name: 'Invalid', mode: 'included', ...input }
        })
      );

    expect(await create({ mode: 'unknown' })).toBe('bad_request');
    expect(await create({ plan: 'x'.repeat(101) })).toBe('bad_request');
    expect(await create({ agentId: 'no-such-agent' })).toBe('bad_request');
    expect(await create({ validFrom: hoursAgo(1), validTo: hoursAgo(2) })).toBe('bad_request');
    expect(await create({ userId: team.id })).toBe('bad_request');
    expect(await create({ userId: archivedUser.id })).toBe('bad_request');
    expect(await create({ userId: foreignUser.id })).toBe('not_found');
    expect(await create({ userId: 'gen_missing' })).toBe('not_found');
    expect(await create({ projectId: other.project.id })).toBe('not_found');
    expect(await testDb.billingDeclaration.count()).toBe(0);
    expect(impactCalls()).toEqual([]);

    let created = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'API keys', mode: 'api' }
    });

    expect(
      await errorCode(
        billingDeclarationService.getBillingDeclarationById({
          organization: other.organization,
          billingDeclarationId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      (
        await (
          await billingDeclarationService.listBillingDeclarations({
            organization: other.organization
          })
        ).run({})
      ).items
    ).toEqual([]);

    for (let input of [
      { mode: 'unknown' as const },
      { validTo: hoursAgo(100) },
      { agentId: 'no-such-agent' }
    ]) {
      expect(
        await errorCode(
          billingDeclarationService.updateBillingDeclaration({
            organization,
            billingDeclaration: created,
            input
          })
        )
      ).toBe('bad_request');
    }
  });

  it('stores the user a merged entity was merged into', async () => {
    let { organization } = await createTestScope();
    let winner = await createEntity(organization.oid);
    let loser = await createEntity(organization.oid, {
      status: 'merged',
      mergedIntoOid: winner.oid
    });

    let created = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'Merged', mode: 'included', userId: loser.id }
    });
    expect(created.user?.id).toBe(winner.id);
  });

  it('matches a declaration of a user merged later as the surviving user', async () => {
    let { organization } = await createTestScope();
    let winner = await createEntity(organization.oid);
    let loser = await createEntity(organization.oid);

    let created = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'Before merge', mode: 'included', userId: loser.id }
    });
    await testDb.entity.update({
      where: { oid: loser.oid },
      data: { status: 'merged', mergedIntoOid: winner.oid }
    });
    resetOverrideCache();

    let { declarations } = await getOrganizationPricing(organization.id);
    expect(declarations).toEqual([
      expect.objectContaining({ id: created.id, userId: winner.id })
    ]);
  });

  it('skips the impact when nothing that affects matching changed', async () => {
    let { organization } = await createTestScope();

    let created = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'Plan', mode: 'included', plan: 'max', validFrom: hoursAgo(10) }
    });
    await billingDeclarationService.updateBillingDeclaration({
      organization,
      billingDeclaration: created,
      input: { name: 'Same', plan: ' max ', mode: 'included', validFrom: created.validFrom }
    });
    expect(impactCalls()).toHaveLength(1);

    await billingDeclarationService.updateBillingDeclaration({
      organization,
      billingDeclaration: created,
      input: { plan: 'pro' }
    });
    expect(impactCalls()).toHaveLength(2);
  });

  it('drops the declarations of an erased user', async () => {
    let { organization } = await createTestScope();
    let user = await createEntity(organization.oid);

    await billingDeclarationService.createBillingDeclaration({
      organization,
      input: { name: 'Seat', mode: 'included', userId: user.id }
    });
    await testDb.entity.delete({ where: { oid: user.oid } });

    expect(await testDb.billingDeclaration.count()).toBe(0);
  });
});
