import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingDeclarationService } from '../../billing/declaration';
import { FACTS_VERSION } from '../../facts/versions';
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
import { closeSessionRedis, getSessionRedis } from '../../sessions/redis';
import { settleSession } from '../../sessions/settle';
import { SUMMARY_VERSION } from '../../sessions/versions';
import { createSessionHarness, store } from '../../sessions/tests/harness';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import {
  expireOverrideCheck,
  getOrganizationOverrides,
  getOrganizationPricing,
  priceOverrideVersionKey,
  publishPriceOverrideVersion,
  resetOverrideCache
} from '../cache';
import { effectivePriceService } from '../effectivePrice';
import { priceOverrideService } from '../priceOverride';

vi.mock('../../knowledge/impact', () => ({
  queuePriceOverrideImpact: vi.fn(async () => {})
}));

let hourMs = 60 * 60 * 1000;

let server: KnowledgeFixtureServer;

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

let impactCalls = () => vi.mocked(queuePriceOverrideImpact).mock.calls.map(([call]) => call);

let errorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code;
  }

  return undefined;
};

let multiplierInput = (input: Record<string, unknown> = {}) => ({
  name: 'Anthropic discount',
  target: 'model' as const,
  targetId: 'claude-sonnet-4-5',
  kind: 'multiplier' as const,
  multiplier: 0.8,
  validFrom: hoursAgo(48),
  ...input
});

let settle = async (harness: Awaited<ReturnType<typeof createSessionHarness>>) => {
  let [record] = await harness.ingest([
    {
      type: 'model.request',
      at: hoursAgo(1),
      sessionId: crypto.randomUUID(),
      data: { model: sonnet, usage: { inputUncached: 1_000_000, output: 100_000 } }
    }
  ]);
  let sessionKey = record!.ctx.session_key!;

  await settleSession({ sessionKey });

  let session = (await harness.session(sessionKey))!;
  let slices = await harness
    .collections()
    .usageSlices.find({ sessionKey, requests: { $gt: 0 } })
    .toArray();

  return { session, slices };
};

describe('price overrides', () => {
  beforeAll(async () => {
    server = await startKnowledgeServer();
    await store.ready();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates, reads, lists, updates and archives overrides with their impact scopes', async () => {
    let { organization, project } = await createTestScope();

    let created = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput({ projectId: project.ref, createdBy: 'usr_1', priority: 3 })
    });

    expect(created.id).toMatch(/^gpo_/);
    let row = await testDb.priceOverride.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({
      organizationOid: organization.oid,
      projectOid: project.oid,
      target: 'model',
      targetId: 'claude-sonnet-4-5',
      kind: 'multiplier',
      priority: 3,
      createdBy: 'usr_1',
      rates: null,
      archivedAt: null
    });
    expect(row.multiplier?.toString()).toBe('0.8');

    expect(impactCalls()).toEqual([
      {
        organizationOid: organization.oid,
        projectOid: project.oid,
        before: null,
        after: {
          target: 'model',
          targetId: 'claude-sonnet-4-5',
          vendorId: null,
          validFrom: created.validFrom,
          validTo: null
        }
      }
    ]);

    let fetched = await priceOverrideService.getPriceOverrideById({
      organization,
      priceOverrideId: created.id
    });
    expect(fetched.project?.id).toBe(project.id);

    let renamed = await priceOverrideService.updatePriceOverride({
      organization,
      priceOverride: fetched,
      input: { name: 'Renamed', reason: 'contract 2026' }
    });
    expect(renamed).toMatchObject({ name: 'Renamed', reason: 'contract 2026' });
    expect(impactCalls()).toHaveLength(1);

    let validTo = new Date();
    let changed = await priceOverrideService.updatePriceOverride({
      organization,
      priceOverride: renamed,
      input: { kind: 'included', vendorId: 'anthropic', validTo, projectId: null }
    });
    expect(changed).toMatchObject({ kind: 'included', multiplier: null, projectOid: null });
    expect(impactCalls()[1]).toEqual({
      organizationOid: organization.oid,
      projectOid: null,
      before: {
        target: 'model',
        targetId: 'claude-sonnet-4-5',
        vendorId: null,
        validFrom: created.validFrom,
        validTo: null
      },
      after: {
        target: 'model',
        targetId: 'claude-sonnet-4-5',
        vendorId: 'anthropic',
        validFrom: created.validFrom,
        validTo
      }
    });

    let other = await priceOverrideService.createPriceOverride({
      organization,
      input: { name: 'Everything', target: 'all', kind: 'included' }
    });

    let list = async (d: Record<string, unknown> = {}) =>
      (
        await (
          await priceOverrideService.listPriceOverrides({ organization, ...d })
        ).run({ limit: 10 })
      ).items.map(item => item.id);

    expect((await list()).sort()).toEqual([changed.id, other.id].sort());
    expect(await list({ targets: ['all'] })).toEqual([other.id]);
    expect(await list({ kinds: ['multiplier'] })).toEqual([]);

    let archived = await priceOverrideService.archivePriceOverride({
      organization,
      priceOverride: changed
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(impactCalls()[3]).toMatchObject({ before: { vendorId: 'anthropic' }, after: null });

    let again = await priceOverrideService.archivePriceOverride({
      organization,
      priceOverride: archived
    });
    expect(again.archivedAt).toEqual(archived.archivedAt);
    expect(impactCalls()).toHaveLength(4);

    expect(await list()).toEqual([other.id]);
    expect((await list({ includeArchived: true })).sort()).toEqual(
      [changed.id, other.id].sort()
    );
    expect(
      (
        await priceOverrideService.getPriceOverrideById({
          organization,
          priceOverrideId: changed.id
        })
      ).archivedAt
    ).toEqual(archived.archivedAt);

    expect(
      await errorCode(
        priceOverrideService.updatePriceOverride({
          organization,
          priceOverride: archived,
          input: { name: 'Again' }
        })
      )
    ).toBe('bad_request');
  });

  it('rejects invalid overrides and keeps organizations apart', async () => {
    let { organization } = await createTestScope();
    let other = await createTestScope();

    let create = (input: Record<string, unknown>) =>
      errorCode(
        priceOverrideService.createPriceOverride({
          organization,
          input: multiplierInput(input) as never
        })
      );

    expect(await create({ targetId: 'no-such-model' })).toBe('bad_request');
    expect(await create({ target: 'offering', targetId: 'claude-sonnet-4-5' })).toBe(
      'bad_request'
    );
    expect(await create({ vendorId: 'no-such-vendor' })).toBe('bad_request');
    expect(await create({ multiplier: null })).toBe('bad_request');
    expect(await create({ projectId: other.project.id })).toBe('not_found');
    expect(await testDb.priceOverride.count()).toBe(0);
    expect(impactCalls()).toEqual([]);

    for (let [target, targetId] of [
      ['offering', 'anthropic:claude-sonnet-4-5-20250929'],
      ['family', 'claude-sonnet'],
      ['lab', 'anthropic'],
      ['agent', 'claude-code'],
      ['vendor', 'aws-bedrock']
    ] as const) {
      await priceOverrideService.createPriceOverride({
        organization,
        input: multiplierInput({ target, targetId })
      });
    }

    let created = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput()
    });

    expect(
      await errorCode(
        priceOverrideService.getPriceOverrideById({
          organization: other.organization,
          priceOverrideId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      (
        await (
          await priceOverrideService.listPriceOverrides({ organization: other.organization })
        ).run({})
      ).items
    ).toEqual([]);

    expect(
      await errorCode(
        priceOverrideService.updatePriceOverride({
          organization,
          priceOverride: created,
          input: { validTo: hoursAgo(100) }
        })
      )
    ).toBe('bad_request');
  });

  it('refreshes an organization’s cached overrides only after its version changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    let a = await createTestScope();
    let b = await createTestScope();

    let insert = (organizationOid: bigint, name: string) =>
      testDb.priceOverride.create({
        data: {
          ...getId('priceOverride'),
          name,
          target: 'all',
          kind: 'included',
          validFrom: hoursAgo(1),
          organizationOid
        }
      });
    let names = async (organizationId: string) =>
      (await getOrganizationOverrides(organizationId)).map(override => override.id);

    expect(await names(a.organization.id)).toEqual([]);
    expect(await names(b.organization.id)).toEqual([]);

    let first = await insert(a.organization.oid, 'a');
    let second = await insert(b.organization.oid, 'b');

    vi.setSystemTime(Date.now() + 16_000);
    expect(await names(a.organization.id)).toEqual([]);

    await publishPriceOverrideVersion(a.organization.id);
    expect(await names(a.organization.id)).toEqual([]);

    vi.setSystemTime(Date.now() + 16_000);
    expect(await names(a.organization.id)).toEqual([first.id]);
    expect(await names(b.organization.id)).toEqual([]);

    await getSessionRedis().del(priceOverrideVersionKey(b.organization.id));
    vi.setSystemTime(Date.now() + 16_000);
    expect(await names(b.organization.id)).toEqual([]);
    await publishPriceOverrideVersion(b.organization.id);
    vi.setSystemTime(Date.now() + 16_000);
    expect(await names(b.organization.id)).toEqual([second.id]);

    let archivedByService = await priceOverrideService.archivePriceOverride({
      organization: a.organization,
      priceOverride: first
    });
    expect(archivedByService.archivedAt).not.toBeNull();
    expect(await names(a.organization.id)).toEqual([]);
  });

  it('caches declarations and billing modes with the overrides under one version', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    let { organization, project } = await createTestScope();
    let user = await testDb.entity.create({
      data: {
        ...getId('entity'),
        kind: 'user',
        status: 'managed',
        organizationOid: organization.oid
      }
    });

    let override = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput({ billingModes: ['api', 'overage', 'api'] })
    });
    expect(override.billingModes).toEqual(['overage', 'api']);

    let declaration = await billingDeclarationService.createBillingDeclaration({
      organization,
      input: {
        name: 'Max seat',
        projectId: project.id,
        userId: user.id,
        agentId: 'claude-code',
        mode: 'included',
        plan: 'max',
        validFrom: hoursAgo(48)
      }
    });

    let pricing = await getOrganizationPricing(organization.id);
    expect(pricing.overrides).toEqual([
      expect.objectContaining({ id: override.id, billingModes: ['overage', 'api'] })
    ]);
    expect(pricing.declarations).toEqual([
      {
        id: declaration.id,
        organizationId: organization.id,
        projectId: project.id,
        userId: user.id,
        agentId: 'claude-code',
        mode: 'included',
        plan: 'max',
        validFrom: declaration.validFrom,
        validTo: null,
        archivedAt: null
      }
    ]);
    expect(await getOrganizationOverrides(organization.id)).toEqual(pricing.overrides);

    let inserted = await testDb.billingDeclaration.create({
      data: {
        ...getId('billingDeclaration'),
        name: 'from another process',
        mode: 'api',
        validFrom: hoursAgo(1),
        organizationOid: organization.oid
      }
    });
    vi.setSystemTime(Date.now() + 16_000);
    expect((await getOrganizationPricing(organization.id)).declarations).toHaveLength(1);

    await publishPriceOverrideVersion(organization.id);
    vi.setSystemTime(Date.now() + 16_000);
    expect(
      (await getOrganizationPricing(organization.id)).declarations.map(item => item.id).sort()
    ).toEqual([declaration.id, inserted.id].sort());

    await billingDeclarationService.archiveBillingDeclaration({
      organization,
      billingDeclaration: declaration
    });
    expect(
      (await getOrganizationPricing(organization.id)).declarations.map(item => item.id)
    ).toEqual([inserted.id]);

    await priceOverrideService.updatePriceOverride({
      organization,
      priceOverride: override,
      input: { billingModes: [] }
    });
    expect((await getOrganizationPricing(organization.id)).overrides).toEqual([
      expect.objectContaining({ id: override.id, billingModes: [] })
    ]);
  });

  it('checks the version immediately once the check is expired, as rebuilds do', async () => {
    let scope = await createTestScope();
    let names = async () =>
      (await getOrganizationOverrides(scope.organization.id)).map(override => override.id);

    expect(await names()).toEqual([]);

    let created = await testDb.priceOverride.create({
      data: {
        ...getId('priceOverride'),
        name: 'from another process',
        target: 'all',
        kind: 'included',
        validFrom: hoursAgo(1),
        organizationOid: scope.organization.oid
      }
    });
    await publishPriceOverrideVersion(scope.organization.id);
    expect(await names()).toEqual([]);

    expireOverrideCheck(scope.organization.id);
    expect(await names()).toEqual([created.id]);
  });

  it('prices settled sessions with the matching override as contract cost', async () => {
    let harness = await createSessionHarness();
    let { organization } = harness.scope;

    let list = await settle(harness);
    expect(list.session.summary!.costComputedUsd?.toString()).toBe('4.5');
    expect(list.session.summary!.costContractUsd).toBeUndefined();
    expect(list.session.summary!.costUsd?.toString()).toBe('4.5');

    let discount = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput()
    });

    let { session, slices } = await settle(harness);
    expect(session.versions.summary).toBe(SUMMARY_VERSION);
    expect(session.versions.facts).toBe(FACTS_VERSION);
    expect(session.summary!.costComputedUsd?.toString()).toBe('4.5');
    expect(session.summary!.costContractUsd?.toString()).toBe('3.6');
    expect(session.summary!.costUsd?.toString()).toBe('3.6');
    expect(session.summary!.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      overrideId: discount.id
    });
    expect(session.summary!.models[0]!.costContractUsd?.toString()).toBe('3.6');
    expect(
      slices.map(slice => [
        slice.costComputedUsd?.toString(),
        slice.costContractUsd?.toString(),
        slice.costUsd?.toString(),
        slice.factsVersion
      ])
    ).toEqual([['4.5', '3.6', '3.6', FACTS_VERSION]]);

    let included = await priceOverrideService.createPriceOverride({
      organization,
      input: {
        name: 'Seat plan',
        target: 'agent',
        targetId: 'claude-code',
        kind: 'included',
        validFrom: hoursAgo(48)
      }
    });
    let free = await settle(harness);
    expect(free.session.summary!.models[0]!.overrideId).toBe(discount.id);

    await priceOverrideService.archivePriceOverride({ organization, priceOverride: discount });
    let covered = await settle(harness);
    expect(covered.session.summary!.models[0]!.overrideId).toBe(included.id);
    expect(covered.session.summary!.costContractUsd?.toString()).toBe('0');
    expect(covered.session.summary!.costUsd?.toString()).toBe('0');

    await priceOverrideService.archivePriceOverride({ organization, priceOverride: included });
    let reverted = await settle(harness);
    expect(reverted.session.summary!.costContractUsd).toBeUndefined();
    expect(reverted.session.summary!.costUsd?.toString()).toBe('4.5');
  });

  it('applies a project-scoped override only inside its project', async () => {
    let inside = await createSessionHarness();
    let outside = await createSessionHarness({
      scope: { organizationRef: inside.scope.organization.ref }
    });
    expect(outside.scope.organization.id).toBe(inside.scope.organization.id);

    let scoped = await priceOverrideService.createPriceOverride({
      organization: inside.scope.organization,
      input: multiplierInput({ projectId: inside.scope.project.id, multiplier: 0.5 })
    });

    let insideSession = (await settle(inside)).session;
    expect(insideSession.summary!.models[0]!.overrideId).toBe(scoped.id);
    expect(insideSession.summary!.costUsd?.toString()).toBe('2.25');

    let outsideSession = (await settle(outside)).session;
    expect(outsideSession.summary!.models[0]!.overrideId).toBeUndefined();
    expect(outsideSession.summary!.costUsd?.toString()).toBe('4.5');
  });

  it('previews list, override and effective rates', async () => {
    let { organization, project } = await createTestScope();
    let at = hoursAgo(1);

    let bare = await effectivePriceService.getEffectivePrice({
      organization,
      input: { modelId: 'claude-sonnet-4-5', at }
    });
    expect(bare).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      override: null,
      effective: { basis: 'list' }
    });
    expect(bare.list.offering?.id).toBe('anthropic:claude-sonnet-4-5-20250929');
    expect(bare.list.priceAssumed).toBe(false);
    expect(bare.effective.pricing?.text?.input).toBe(3);

    let discount = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput({ projectId: project.id, multiplier: 0.5 })
    });

    for (let input of [
      { modelId: 'claude-sonnet-4-5' },
      { offeringId: 'anthropic:claude-sonnet-4-5-20250929' },
      { raw: sonnet.id, provider: sonnet.provider }
    ]) {
      let price = await effectivePriceService.getEffectivePrice({
        organization,
        input: { ...input, projectId: project.ref, agent: 'claude_code', at }
      });

      expect(price).toMatchObject({
        projectId: project.id,
        modelId: 'claude-sonnet-4-5',
        agentId: 'claude-code',
        effective: { basis: 'multiplier' }
      });
      expect(price.override?.id).toBe(discount.id);
      expect(price.list.pricePeriod?.pricing.text?.input).toBe(3);
      expect(price.effective.pricing?.text).toMatchObject({ input: 1.5, output: 7.5 });
    }

    let organizationWide = await effectivePriceService.getEffectivePrice({
      organization,
      input: { modelId: 'claude-sonnet-4-5', at }
    });
    expect(organizationWide.override).toBeNull();

    let beforeOverride = await effectivePriceService.getEffectivePrice({
      organization,
      input: { modelId: 'claude-sonnet-4-5', projectId: project.id, at: hoursAgo(60) }
    });
    expect(beforeOverride.override).toBeNull();

    let apiOnly = await priceOverrideService.createPriceOverride({
      organization,
      input: multiplierInput({ billingModes: ['api'], multiplier: 0.25 })
    });
    let priceFor = async (billingMode?: 'api' | 'included') =>
      await effectivePriceService.getEffectivePrice({
        organization,
        input: { modelId: 'claude-sonnet-4-5', at, billingMode }
      });

    expect(await priceFor('api')).toMatchObject({
      billingMode: 'api',
      override: { id: apiOnly.id },
      effective: { basis: 'multiplier' }
    });
    expect(await priceFor('included')).toMatchObject({
      billingMode: 'included',
      override: null
    });
    expect(await priceFor()).toMatchObject({ billingMode: 'unknown', override: null });

    expect(
      await errorCode(
        effectivePriceService.getEffectivePrice({
          organization,
          input: { modelId: 'no-such-model' }
        })
      )
    ).toBe('not_found');
  });
});
