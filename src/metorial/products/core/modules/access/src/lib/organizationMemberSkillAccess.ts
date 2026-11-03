import type { Prisma, Project } from '@metorial/db';
import { db } from '@metorial/db';
import type { StoreResourceAccessLevel } from '../definitions/storeResourceAccess';
import type { ResourceAuthorization } from '../services/resourceAuthorization';
import { isStoreResourceFlagEnabled } from './storeResourceFlags';

let consumerProfileOrganizationLinkSelect = {
  organizationActorOid: true,
  organizationMemberOid: true,
  surface: { select: { isInternal: true, internalSurfaceUniqueIdentifier: true } },
  consumer: {
    select: {
      organizationActorOid: true,
      organizationMemberOid: true,
      consumerOrganizationActors: { select: { organizationActorOid: true } }
    }
  }
} satisfies Prisma.ConsumerProfileSelect;

export type ConsumerProfileOrganizationLink = Prisma.ConsumerProfileGetPayload<{
  select: typeof consumerProfileOrganizationLinkSelect;
}>;

export let getConsumerProfileOrganizationLink = async (d: { consumerProfileOid: bigint }) =>
  await db.consumerProfile.findUnique({
    where: { oid: d.consumerProfileOid },
    select: consumerProfileOrganizationLinkSelect
  });

export let findLinkedOrganizationMember = async (d: {
  project: Pick<Project, 'oid'>;
  profile: ConsumerProfileOrganizationLink;
}) => {
  let organizationActorOids = [
    d.profile.organizationActorOid,
    ...(d.profile.consumer.organizationActorOid
      ? [d.profile.consumer.organizationActorOid]
      : []),
    ...d.profile.consumer.consumerOrganizationActors.map(actor => actor.organizationActorOid)
  ];

  let organizationMemberOids = [
    d.profile.organizationMemberOid,
    d.profile.consumer.organizationMemberOid
  ].filter((oid): oid is bigint => !!oid);

  return await db.organizationMember.findFirst({
    where: {
      status: 'active',
      OR: [
        ...(organizationMemberOids.length ? [{ oid: { in: organizationMemberOids } }] : []),
        { actorOid: { in: organizationActorOids } }
      ],
      organization: { projects: { some: { oid: d.project.oid } } }
    },
    select: { oid: true }
  });
};

export type OrganizationMemberSkillAccessProject = Pick<Project, 'oid'> &
  Partial<Pick<Project, 'allowOrganizationMemberFullSkillAccess'>>;

let getAllowOrganizationMemberFullSkillAccess = async (
  project: OrganizationMemberSkillAccessProject
) =>
  project.allowOrganizationMemberFullSkillAccess ??
  !!(
    await db.project.findUnique({
      where: { oid: project.oid },
      select: { allowOrganizationMemberFullSkillAccess: true }
    })
  )?.allowOrganizationMemberFullSkillAccess;

export let isOrganizationMemberFullSkillAccessEnabled = async (d: {
  project: OrganizationMemberSkillAccessProject;
}) =>
  (await getAllowOrganizationMemberFullSkillAccess(d.project)) &&
  (await isStoreResourceFlagEnabled({ project: d.project, flag: 'store-access-v2' }));

let resolveOrganizationMemberSkillAccess = async (d: {
  project: OrganizationMemberSkillAccessProject;
  consumerProfileOid: bigint | null | undefined;
}) => {
  if (!d.consumerProfileOid) return false;
  if (!(await isOrganizationMemberFullSkillAccessEnabled({ project: d.project }))) {
    return false;
  }

  let profile = await getConsumerProfileOrganizationLink({
    consumerProfileOid: d.consumerProfileOid
  });
  if (!profile) return false;

  return !!(await findLinkedOrganizationMember({ project: d.project, profile }));
};

let authorizationCacheTtlMs = 30_000;
let authorizationCache = new WeakMap<
  ResourceAuthorization,
  { expiresAt: number; projectOid: bigint; result: Promise<boolean> }
>();

export let hasOrganizationMemberSkillAccess = async (
  d: { project: OrganizationMemberSkillAccessProject } & (
    { authorization: ResourceAuthorization } | { consumerProfileOid: bigint }
  )
) => {
  if (!('authorization' in d)) {
    return await resolveOrganizationMemberSkillAccess(d);
  }
  if (d.authorization.type == 'privileged') return false;

  let cached = authorizationCache.get(d.authorization);
  if (cached && cached.expiresAt > Date.now() && cached.projectOid == d.project.oid) {
    return await cached.result;
  }

  let result = resolveOrganizationMemberSkillAccess({
    project: d.project,
    consumerProfileOid: d.authorization.resourceActor.consumerProfileOid
  });
  authorizationCache.set(d.authorization, {
    expiresAt: Date.now() + authorizationCacheTtlMs,
    projectOid: d.project.oid,
    result
  });
  result.catch(() => authorizationCache.delete(d.authorization));

  return await result;
};

export let getEffectiveSkillAccessLevel = async (d: {
  project: OrganizationMemberSkillAccessProject;
  authorization: ResourceAuthorization;
  level: StoreResourceAccessLevel;
}): Promise<StoreResourceAccessLevel> => {
  if (d.level == 'read' || d.authorization.type == 'privileged') return d.level;

  return (await hasOrganizationMemberSkillAccess(d)) ? 'read' : d.level;
};
