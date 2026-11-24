import { expectServiceError, uniqueId } from '@metorial/e2e';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import { chat, createTenant, createToken, useCatalog, useUpstream } from '../support/fixtures';

describe('ai-gateway platform limit api', () => {
  useCatalog();
  useUpstream();

  it('lists the projects of an organization as limit targets', async () => {
    let tenant = await createTenant();
    let second = await gateway.project.upsert({
      organizationId: tenant.organization.id,
      ref: uniqueId('project')
    });

    let all = await gateway.platformLimit.listTargets({
      organizationRef: tenant.organization.ref
    });
    expect(all.map(target => target.id).sort()).toEqual([tenant.project.id, second.id].sort());
    expect(all[0]).toMatchObject({
      object: 'ai_gateway#platform_limit_target',
      organizationId: tenant.organization.id,
      organizationRef: tenant.organization.ref,
      platformLimits: [],
      disabled: null,
      billingRestriction: null
    });

    let one = await gateway.platformLimit.listTargets({
      organizationRef: tenant.organization.ref,
      projectRef: second.ref
    });
    expect(one.map(target => target.id)).toEqual([second.id]);

    expect(
      await gateway.platformLimit.listTargets({ organizationRef: uniqueId('unknown') })
    ).toEqual([]);
  });

  it('gets targets by project id', async () => {
    let [a, b] = await Promise.all([createTenant(), createTenant()]);

    let targets = await gateway.platformLimit.getTargets({
      projectIds: [a.project.id, b.project.id, 'does-not-exist']
    });

    expect(targets.map(target => target.id).sort()).toEqual(
      [a.project.id, b.project.id].sort()
    );
  });

  it('syncs limits onto a project', async () => {
    let tenant = await createTenant();
    let limits = [
      { metric: 'requests' as const, amount: 100, intervalSeconds: 3600 },
      { metric: 'metorial_spend_usd' as const, amount: 5, intervalSeconds: 86_400 }
    ];

    let synced = await gateway.platformLimit.sync({ projectId: tenant.project.id, limits });

    expect(synced).toMatchObject({ id: tenant.project.id, platformLimits: limits });
    expect(synced.platformLimitsSyncedAt).toBeTruthy();

    let project = await gateway.project.get({
      organizationId: tenant.organization.id,
      projectId: tenant.project.id
    });
    expect(project.platformLimits).toEqual(limits);
  });

  it('rejects invalid limits and unknown projects', async () => {
    let tenant = await createTenant();

    await expect(
      gateway.platformLimit.sync({
        projectId: tenant.project.id,
        limits: [{ metric: 'requests', amount: 1, intervalSeconds: 0 }]
      })
    ).rejects.toThrow();
    await expectServiceError(
      gateway.platformLimit.sync({ projectId: 'does-not-exist', limits: [] }),
      'not_found'
    );
  });

  it('keeps the disabled state unless a sync changes it', async () => {
    let tenant = await createTenant();

    await gateway.platformLimit.sync({
      projectId: tenant.project.id,
      limits: [],
      disabled: { reason: 'Abuse' }
    });
    let untouched = await gateway.platformLimit.sync({
      projectId: tenant.project.id,
      limits: []
    });
    expect(untouched.disabled).toMatchObject({ reason: 'Abuse' });

    let cleared = await gateway.platformLimit.sync({
      projectId: tenant.project.id,
      limits: [],
      disabled: null
    });
    expect(cleared.disabled).toBeNull();
  });

  it('drains and acknowledges trip and usage events', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    await gateway.platformLimit.sync({
      projectId: tenant.project.id,
      limits: [{ metric: 'requests', amount: 1, intervalSeconds: 86_400 }]
    });

    await chat(token.secret, catalogModels.haiku);
    await chat(token.secret, catalogModels.haiku);
    await chat(token.secret, catalogModels.haiku);

    let before = Date.now() + 2 * 3_600_000;
    let drained = await gateway.platformLimit.drainEvents({
      tripsBefore: before,
      usageBefore: before
    });
    expect(drained.object).toBe('ai_gateway#platform_limit_events');

    let trips = drained.trips.flatMap(bucket =>
      bucket.entries.filter(entry => entry.projectId == tenant.project.id)
    );
    expect(trips).toMatchObject([{ metric: 'requests', count: 2 }]);

    let usage = drained.usage.flatMap(hour =>
      hour.entries.filter(entry => entry.projectId == tenant.project.id)
    );
    expect(usage[0]).toMatchObject({ metric: 'requests', used: 1, denied: 2 });

    expect(
      await gateway.platformLimit.ackEvents({
        tripBuckets: drained.trips.map(bucket => bucket.bucketStart),
        usageHours: drained.usage.map(hour => hour.hourStart)
      })
    ).toEqual({ object: 'ai_gateway#platform_limit_events.acknowledged' });

    let after = await gateway.platformLimit.drainEvents({
      tripsBefore: before,
      usageBefore: before
    });
    expect(
      after.trips.flatMap(bucket =>
        bucket.entries.filter(entry => entry.projectId == tenant.project.id)
      )
    ).toEqual([]);
  });
});
