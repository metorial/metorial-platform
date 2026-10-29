import type { ConsumerProfile, Instance, Project, ResourceActor } from '@metorial/db';
import { db } from '@metorial/db';
import type { AnyAccessTagSelector } from '../services/accessTag';
import { createResourceAuthorization } from '../services/resourceAuthorization';
import { isStoreResourceFlagEnabled } from './storeResourceFlags';

let cliSurfaceIdentifier = 'cli';

let isCliOrganizationMember = async (d: {
  project: Pick<Project, 'oid'>;
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
}) => {
  if (!(await isStoreResourceFlagEnabled({ project: d.project, flag: 'store-access-v2' }))) {
    return false;
  }

  let profile = await db.consumerProfile.findUnique({
    where: { oid: d.consumerProfile.oid },
    select: {
      organizationActorOid: true,
      organizationMemberOid: true,
      surface: { select: { isInternal: true, internalSurfaceUniqueIdentifier: true } },
      consumer: {
        select: {
          organizationActorOid: true,
          consumerOrganizationActors: { select: { organizationActorOid: true } }
        }
      }
    }
  });
  if (
    !profile?.surface.isInternal ||
    profile.surface.internalSurfaceUniqueIdentifier != cliSurfaceIdentifier
  ) {
    return false;
  }

  let organizationActorOids = [
    profile.organizationActorOid,
    ...(profile.consumer.organizationActorOid ? [profile.consumer.organizationActorOid] : []),
    ...profile.consumer.consumerOrganizationActors.map(actor => actor.organizationActorOid)
  ];

  let member = await db.organizationMember.findFirst({
    where: {
      status: 'active',
      OR: [
        ...(profile.organizationMemberOid ? [{ oid: profile.organizationMemberOid }] : []),
        { actorOid: { in: organizationActorOids } }
      ],
      organization: { projects: { some: { oid: d.project.oid } } }
    },
    select: { oid: true }
  });

  return !!member;
};

export let resolveResourceAuthorization = async (d: {
  project: Pick<Project, 'oid'>;
  instance: Pick<Instance, 'oid' | 'projectOid'>;
  resourceActor?: ResourceActor;
  member?: { actor: { oid: bigint } };
  consumerProfile?: Pick<ConsumerProfile, 'oid' | 'instanceOid'> & {
    consumer?: { oid: bigint } | null;
  };
  accessTags?: AnyAccessTagSelector;
}) => {
  let isMember = !!d.member?.actor;
  let isConsumer = !!d.consumerProfile?.consumer && !isMember;
  let isCliMember =
    isConsumer &&
    (await isCliOrganizationMember({
      project: d.project,
      consumerProfile: d.consumerProfile!
    }));

  let authorization = createResourceAuthorization({
    restricted: isConsumer && !isCliMember,
    resourceActor: d.resourceActor,
    accessTags: d.accessTags,
    project: d.project,
    instance: d.instance,
    consumerProfile: d.consumerProfile
  });

  return { authorization, isMember, isCliMember };
};
