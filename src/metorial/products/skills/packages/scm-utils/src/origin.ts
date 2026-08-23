import { createOriginClient } from '@metorial-platform-systems/origin-client';
import type { SkillDestination } from '@metorial/db';
import { db, ID } from '@metorial/db';
import { getProjectTenantIdentifier } from '@metorial/skills-common';
import { getSkillsScmUtilsEnv } from './env';

type OriginClient = ReturnType<typeof createOriginClient>;

let originClient: OriginClient | undefined;

let getOriginClient = (): OriginClient => {
  if (!originClient) {
    originClient = createOriginClient({
      endpoint: getSkillsScmUtilsEnv().origin.ORIGIN_URL
    });
  }

  return originClient;
};

export let origin = new Proxy({} as OriginClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getOriginClient(), prop, receiver);
  }
});

export type OriginTenantProject = { oid: bigint; name?: string };

export let getOriginTenant = async (project: OriginTenantProject) => {
  let name =
    project.name ??
    (
      await db.project.findUniqueOrThrow({
        where: { oid: project.oid },
        select: { name: true }
      })
    ).name;

  return await origin.tenant.upsert({
    identifier: getProjectTenantIdentifier(project),
    name
  });
};

export let createSkillDestination = async (d: {
  project: OriginTenantProject;
  purpose?: string;
}): Promise<SkillDestination> => {
  let originTenant = await getOriginTenant(d.project);

  let codeBucket = await origin.codeBucket.create({
    tenantId: originTenant.id,
    purpose: d.purpose ?? 'cargo.skill.destination',
    isReadOnly: false
  });

  return await db.skillDestination.create({
    data: {
      id: await ID.generateId('skillDestination'),
      codeBucketId: codeBucket.id,
      lastUsedAt: new Date()
    }
  });
};

export let getSkillDestinationEditorUrl = async (d: {
  project: OriginTenantProject;
  destination: Pick<SkillDestination, 'codeBucketId'>;
  isReadOnly?: boolean;
}) => {
  let originTenant = await getOriginTenant(d.project);
  let res = await origin.codeBucket.getEditorToken({
    tenantId: originTenant.id,
    codeBucketId: d.destination.codeBucketId,
    isReadOnly: d.isReadOnly
  });

  return {
    url: res.url,
    expiresAt: res.expiresAt
  };
};
