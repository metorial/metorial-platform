import { uniqueEmail, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerProfile, ConsumerSurface, MagicMcpServer } from '@metorial/db';
import type { AnyAccessTagSelector } from '@metorial/module-access';
import { consumerAccessService } from '@metorial/module-consumer-access';
import {
  consumerGroupService,
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { applyEnabledFlags, defaultFlags, setFlagProvider } from '@metorial/module-flags';
import { magicMcpServerService } from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { afterEach, beforeEach } from 'vitest';

let stackFlags = () => applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS);

export let useStoreResourceFlags = (enabled: boolean) => {
  beforeEach(() => {
    setFlagProvider(async () => ({
      ...stackFlags(),
      'store-participants-v2': enabled,
      'store-access-v2': enabled
    }));
  });

  afterEach(() => {
    setFlagProvider(async () => stackFlags());
  });
};

export let createSurface = async (
  fixture: OrganizationFixture,
  input: { allowConsumerSkillAuthoring?: boolean; allowConsumerSkillPublishing?: boolean } = {}
) =>
  await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: {
      name: uniqueId('Entities Surface'),
      sessionExpiryTimeInSeconds: 3600,
      ...input
    }
  });

export let createPortalSurface = async (fixture: OrganizationFixture) => {
  let portal = await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Entities Portal') }
  });

  return await db.consumerSurface.findUniqueOrThrow({ where: { oid: portal.surfaceOid } });
};

export let createGroup = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface
) =>
  await consumerGroupService.createConsumerGroup({
    consumerSurface,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Entities Group') }
  });

export let getEveryoneGroup = async (consumerSurface: ConsumerSurface) =>
  await db.consumerGroup.findFirstOrThrow({
    where: { surfaceOid: consumerSurface.oid, isDefaultEveryoneGroup: true }
  });

export let createProfile = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface,
  input: { email?: string } = {}
) => {
  let consumerProfile = await consumerProfileService.createConsumerProfile({
    surface: consumerSurface,
    email: input.email ?? uniqueEmail('entities'),
    name: 'E2E Entities Consumer',
    auditScope: fixture.auditScope
  });

  return await db.consumerProfile.findUniqueOrThrow({
    where: { oid: consumerProfile.oid },
    include: { consumer: true, personalConsumerGroup: true }
  });
};

export let addToGroups = async (
  fixture: OrganizationFixture,
  consumerProfile: Pick<ConsumerProfile, 'id' | 'surfaceOid'>,
  groupIds: string[]
) => {
  let consumerSurface = await db.consumerSurface.findUniqueOrThrow({
    where: { oid: consumerProfile.surfaceOid }
  });

  await consumerProfileService.assignToGroups({
    consumerProfile: await consumerProfileService.getConsumerProfileById({
      consumerSurface,
      consumerProfileId: consumerProfile.id
    }),
    groupIds,
    auditScope: fixture.auditScope
  });
};

export let consumerView = async (consumerProfile: ConsumerProfile) => {
  let consumerGroups = await consumerProfileService.getGroupsForProfile({ consumerProfile });
  let accessTags: AnyAccessTagSelector = consumerGroups.map(group => ({
    accessTagOid: group.accessTagOid
  }));

  return { consumerGroups, accessTags };
};

export let createMagicServer = async (
  fixture: OrganizationFixture,
  input: { name?: string } = {}
) =>
  await magicMcpServerService.createMagicMcpServer({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('Entities Server'),
      description: 'Created by the e2e suite'
    }
  });

export let grantMagicServer = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface,
  consumerGroup: Parameters<
    typeof consumerAccessService.createConsumerAccess
  >[0]['consumerGroup'],
  magicMcpServer: MagicMcpServer
) =>
  await consumerAccessService.createConsumerAccess({
    organization: fixture.organization,
    consumerSurface,
    consumerGroup,
    auditScope: fixture.auditScope,
    access: { type: 'magic_mcp_server', magicMcpServer }
  });
