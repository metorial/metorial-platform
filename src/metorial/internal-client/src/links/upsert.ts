import { nebula, subspace } from '../clients';
import type { InternalActorLink } from './types';

export let upsertNebulaTenant = async (d: { identifier: string; name: string }) =>
  await nebula.tenant.upsert({
    identifier: d.identifier,
    name: d.name
  });

export let upsertSubspaceTenant = async (d: {
  identifier: string;
  name: string;
  onlyAllowTrustedProviders: boolean;
  resourceTenantId: string;
  resourceTenantIdentifier: string;
  environments: Array<{
    identifier: string;
    name: string;
    type: 'development' | 'production';
    resourceGroupId: string;
    resourceGroupIdentifier: string;
  }>;
}) =>
  await subspace.tenant.upsert({
    identifier: d.identifier,
    name: d.name,
    onlyAllowTrustedProviders: d.onlyAllowTrustedProviders,
    resourceTenantId: d.resourceTenantId,
    resourceTenantIdentifier: d.resourceTenantIdentifier,
    environments: d.environments
  });

export let upsertSubspaceEnvironment = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  type: 'development' | 'production';
  resourceGroupId: string;
  resourceGroupIdentifier: string;
}) =>
  await subspace.environment.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: d.type,
    resourceGroupId: d.resourceGroupId,
    resourceGroupIdentifier: d.resourceGroupIdentifier
  });

export let upsertSubspaceActor = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  organizationActorId?: string;
  consumerId?: string;
  resourceActorId: string;
  resourceActorIdentifier: string;
}): Promise<InternalActorLink> =>
  await subspace.actor.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: 'external',
    organizationActorId: d.organizationActorId,
    consumerId: d.consumerId,
    resourceActorId: d.resourceActorId,
    resourceActorIdentifier: d.resourceActorIdentifier
  });
