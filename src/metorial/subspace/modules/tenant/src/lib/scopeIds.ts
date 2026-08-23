import type { Instance, OrganizationActor, Project } from '@metorial/db';

export let getProjectInternalTenantIdentifier = (project: Pick<Project, 'oid'>) =>
  `mte-pro-${project.oid}`;

export let getInstanceInternalEnvironmentIdentifier = (instance: Pick<Instance, 'oid'>) =>
  `mte-ins-${instance.oid}`;

export let getOrganizationActorInternalActorIdentifier = (
  organizationActor: Pick<OrganizationActor, 'id'>
) => `mte-oac-${organizationActor.id}`;
