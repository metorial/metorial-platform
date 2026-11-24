import { eventually, uniqueId, type BootstrappedOrganization } from '@metorial/e2e';
import { serviceCatalogModels, trackedConsumer } from '@metorial/agent-tracking-e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { expect } from 'vitest';

export let sonnet = 'claude-sonnet-4-5-20250929';

export let haiku = 'claude-haiku-4-5-20251001';

export let madeUpModel = 'claude-e2e-unreleased-model';

export let minuteMs = 60 * 1000;

export let dayMs = 24 * 60 * minuteMs;

export let isoDate = (at: Date | number) => new Date(at).toISOString().slice(0, 10);

export let readScope = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);

  return {
    organization: fixture.organization,
    project: fixture.project,
    instance: fixture.instance
  };
};

export let createSyncedConsumer = async (org: BootstrappedOrganization, email: string) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let surface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let profile = await consumerProfileService.createConsumerProfile({
    surface,
    email,
    name: 'E2E Profile',
    auditScope: fixture.auditScope
  });
  let consumer = await db.consumer.findUniqueOrThrow({ where: { oid: profile.consumerOid } });

  await eventually(() => trackedConsumer(org.ids, consumer.id), {
    timeoutMs: 60_000,
    intervalMs: 500
  });

  return consumer;
};

export let loadCatalog = async (
  ids: { organizationId: string; instanceId: string },
  d: { unknownModels?: string[] } = {}
) => {
  let catalog = await serviceCatalogModels(ids);
  for (let raw of [sonnet, haiku]) expect(catalog.has(raw), raw).toBe(true);
  for (let raw of d.unknownModels ?? []) expect(catalog.get(raw), raw).toBeNull();

  let known = { sonnet: catalog.get(sonnet) ?? null, haiku: catalog.get(haiku) ?? null };
  expect(known.haiku === null).toBe(known.sonnet === null);

  return known.sonnet && known.haiku
    ? { present: true as const, sonnet: known.sonnet, haiku: known.haiku }
    : { present: false as const };
};
