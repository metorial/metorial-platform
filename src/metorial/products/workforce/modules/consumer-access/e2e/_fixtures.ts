import { uniqueEmail, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import {
  ID,
  type ConsumerProfile,
  type ConsumerSurface,
  type MagicMcpServer
} from '@metorial/db';
import {
  createResourceAuthorization,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import {
  consumerGroupService,
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { magicMcpServerService } from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { skillService } from '@metorial/module-skill';

export let createSurface = async (fixture: OrganizationFixture) =>
  await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Access Surface'), sessionExpiryTimeInSeconds: 3600 }
  });

export let createPortalSurface = async (fixture: OrganizationFixture) => {
  let portal = await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Access Portal') }
  });

  return await db.consumerSurface.findUniqueOrThrow({ where: { oid: portal.surfaceOid } });
};

export let createGroup = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface,
  input: { ssoGroupIds?: string[] } = {}
) =>
  await consumerGroupService.createConsumerGroup({
    consumerSurface,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Access Group'), ssoGroupIds: input.ssoGroupIds }
  });

export let getEveryoneGroup = async (consumerSurface: ConsumerSurface) =>
  await db.consumerGroup.findFirstOrThrow({
    where: { surfaceOid: consumerSurface.oid, isDefaultEveryoneGroup: true }
  });

export let createProfile = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface
) => {
  let consumerProfile = await consumerProfileService.createConsumerProfile({
    surface: consumerSurface,
    email: uniqueEmail('access'),
    name: 'E2E Access Consumer',
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
  let enriched = await consumerProfileService.getConsumerProfileById({
    consumerSurface,
    consumerProfileId: consumerProfile.id
  });

  await consumerProfileService.assignToGroups({
    consumerProfile: enriched,
    groupIds,
    auditScope: fixture.auditScope
  });
};

export let accessTagsFor = async (
  consumerProfile: ConsumerProfile,
  ssoGroupIds?: string[]
): Promise<AnyAccessTagSelector> => {
  let groups = await consumerProfileService.getGroupsForProfile({
    consumerProfile,
    ssoGroupIds
  });
  return groups.map(group => ({ accessTagOid: group.accessTagOid }));
};

export let createMagicServer = async (
  fixture: OrganizationFixture,
  input: { source?: MagicMcpServer['source']; name?: string } = {}
) =>
  await magicMcpServerService.createMagicMcpServer({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('Access Server'),
      description: 'Created by the e2e suite',
      source: input.source
    }
  });

export let archiveMagicServer = async (
  fixture: OrganizationFixture,
  magicMcpServer: MagicMcpServer
) =>
  await magicMcpServerService.archiveMagicMcpServer({
    server: magicMcpServer,
    auditScope: fixture.auditScope
  });

export let createSkill = async (fixture: OrganizationFixture) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: createResourceAuthorization({ restricted: false }),
      name: uniqueId('access-skill'),
      description: 'Created by the e2e suite'
    }
  });

let isForbidden = (error: any) => error?.data?.code == 'forbidden';

export let canReadMagicServer = async (
  magicMcpServer: MagicMcpServer,
  accessTags: AnyAccessTagSelector
) => {
  try {
    await magicMcpServerService.checkConsumerReadAccess({
      server: magicMcpServer,
      accessTags
    });
    return true;
  } catch (error) {
    if (isForbidden(error)) return false;
    throw error;
  }
};

export let canWriteMagicServer = async (
  magicMcpServer: MagicMcpServer,
  accessTags: AnyAccessTagSelector
) => {
  try {
    await magicMcpServerService.checkWriteAccess({ server: magicMcpServer, accessTags });
    return true;
  } catch (error) {
    if (isForbidden(error)) return false;
    throw error;
  }
};

export let countGrants = async (d: {
  accessTagOid: bigint;
  magicMcpServerOid?: bigint;
  skillOid?: bigint;
}) =>
  await db.accessTagEntity.count({
    where: {
      accessTagOid: d.accessTagOid,
      magicMcpServerOid: d.magicMcpServerOid,
      skillOid: d.skillOid
    }
  });
