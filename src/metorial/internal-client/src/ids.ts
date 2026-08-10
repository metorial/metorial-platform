import type {
  Consumer,
  Instance,
  Organization,
  OrganizationActor,
  Project,
  User
} from '@metorial/db';

export let defaultInternalEnvironmentIdentifier = 'default';

export let getProjectInternalTenantIdentifier = (project: Pick<Project, 'oid'>) =>
  `mte-pro-${project.oid}`;

export let getOrganizationInternalTenantIdentifier = (
  organization: Pick<Organization, 'oid'>
) => `mte-org-${organization.oid}`;

export let getUserInternalTenantIdentifier = (user: Pick<User, 'oid'>) =>
  `mte-usr-${user.oid}`;

export let getInstanceInternalEnvironmentIdentifier = (instance: Pick<Instance, 'oid'>) =>
  `mte-ins-${instance.oid}`;

export let getOrganizationActorInternalActorIdentifier = (
  organizationActor: Pick<OrganizationActor, 'id'>
) => `mte-oac-${organizationActor.id}`;

export let getConsumerInternalActorIdentifier = (consumer: Pick<Consumer, 'id'>) =>
  `mte-con-${consumer.id}`;
