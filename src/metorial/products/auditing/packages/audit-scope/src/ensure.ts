import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Context } from '@metorial/context';
import { db } from '@metorial/db';
import {
  resolveResourceScopeForOwner,
  resourceActorService,
  resourceGroupService,
  type ResourceScope
} from '@metorial/module-resource-tenant';
import { createAuditScope, type AuditActor, type AuditScope } from './scope';

type OrganizationInput = {
  id: string;
};

type ProjectInput = {
  id: string;
};

type OrganizationActorInput = {
  oid: bigint;
  id: string;
  resourceActors?: {
    oid: bigint;
    resourceTenantOid: bigint;
  }[];
};

type OrganizationMemberInput = {
  actor: OrganizationActorInput;
};

let resolveOrganizationResources = async (
  organization: OrganizationInput
): Promise<ResourceScope> =>
  await resolveResourceScopeForOwner({
    type: 'organization',
    organization
  });

let resolveProjectResources = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
}): Promise<ResourceScope> => {
  let organizationScope = await resolveOrganizationResources(d.organization);
  let project = await db.project.findUnique({
    where: {
      id: d.project.id
    },
    include: {
      organization: {
        select: {
          id: true
        }
      },
      resourceGroup: true
    }
  });

  if (!project || project.organization.id != d.organization.id) {
    throw new ServiceError(notFoundError('project', d.project.id));
  }

  if (project.resourceGroup?.resourceTenantOid == organizationScope.resourceTenant.oid) {
    return {
      resourceTenant: organizationScope.resourceTenant,
      resourceGroup: project.resourceGroup
    };
  }

  let resourceGroup = await resourceGroupService.upsertResourceGroup({
    resourceTenant: organizationScope.resourceTenant,
    input: {
      identifier: `mte-pro-${project.oid}`,
      name: project.name,
      type: 'production'
    }
  });

  await db.project.update({
    where: {
      oid: project.oid
    },
    data: {
      resourceGroupOid: resourceGroup.oid
    }
  });

  return {
    resourceTenant: organizationScope.resourceTenant,
    resourceGroup
  };
};

let resolveOrganizationResourceActor = async (d: {
  resourceTenant: ResourceScope['resourceTenant'];
  organizationActor: OrganizationActorInput;
}) =>
  d.organizationActor.resourceActors?.find(
    actor => actor.resourceTenantOid == d.resourceTenant.oid
  ) ??
  (await resourceActorService.ensureOrganizationActor({
    resourceTenant: d.resourceTenant,
    organizationActorOid: d.organizationActor.oid
  }));

let createOrganizationActorAuditScope = async (d: {
  resources: ResourceScope;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<AuditScope> => {
  let resourceActor = await resolveOrganizationResourceActor({
    resourceTenant: d.resources.resourceTenant,
    organizationActor: d.organizationActor
  });

  return createAuditScope({
    ...d.resources,
    resourceActor,
    actor: {
      type: 'org_actor',
      id: d.organizationActor.id
    },
    context: d.context
  });
};

export let ensureOrganizationAuditScope = async (d: {
  organization: OrganizationInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> => {
  let resources = await resolveOrganizationResources(d.organization);

  return createAuditScope({
    ...resources,
    actor: d.actor,
    context: d.context
  });
};

export let ensureOrganizationActorAuditScope = async (d: {
  organization: OrganizationInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<AuditScope> =>
  await createOrganizationActorAuditScope({
    resources: await resolveOrganizationResources(d.organization),
    organizationActor: d.organizationActor,
    context: d.context
  });

export let ensureOrganizationMemberAuditScope = async (d: {
  organization: OrganizationInput;
  member: OrganizationMemberInput;
  context: Context;
}): Promise<AuditScope> =>
  await ensureOrganizationActorAuditScope({
    organization: d.organization,
    organizationActor: d.member.actor,
    context: d.context
  });

export let ensureProjectAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> => {
  let resources = await resolveProjectResources(d);

  return createAuditScope({
    ...resources,
    actor: d.actor,
    context: d.context
  });
};

export let ensureProjectActorAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<AuditScope> =>
  await createOrganizationActorAuditScope({
    resources: await resolveProjectResources(d),
    organizationActor: d.organizationActor,
    context: d.context
  });
