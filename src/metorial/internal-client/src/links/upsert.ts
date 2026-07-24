import { nebula, subspace, synthesis } from '../clients';
import type { InternalActorLink } from './types';

export let upsertSynthesisTenant = async (d: { identifier: string; name: string }) =>
  await synthesis.tenant.upsert({
    identifier: d.identifier,
    name: d.name
  });

export let upsertNebulaTenant = async (d: { identifier: string; name: string }) =>
  await nebula.tenant.upsert({
    identifier: d.identifier,
    name: d.name
  });

export let upsertSubspaceTenant = async (d: {
  identifier: string;
  name: string;
  onlyAllowTrustedProviders: boolean;
  environments: Array<{
    identifier: string;
    name: string;
    type: 'development' | 'production';
  }>;
}) =>
  await subspace.tenant.upsert({
    identifier: d.identifier,
    name: d.name,
    onlyAllowTrustedProviders: d.onlyAllowTrustedProviders,
    environments: d.environments
  });

export let upsertSynthesisEnvironment = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  type: 'development' | 'production';
}) =>
  await synthesis.environment.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: d.type
  });

export let upsertSubspaceEnvironment = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  type: 'development' | 'production';
}) =>
  await subspace.environment.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: d.type
  });

export let upsertSynthesisActor = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  type?: 'external' | 'system';
  organizationActorId?: string;
  consumerId?: string;
}): Promise<InternalActorLink> =>
  await synthesis.actor.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: d.type ?? 'external',
    organizationActorId: d.organizationActorId,
    consumerId: d.consumerId
  });

export let upsertSubspaceActor = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
  organizationActorId?: string;
  consumerId?: string;
}): Promise<InternalActorLink> =>
  await subspace.actor.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name,
    type: 'external',
    organizationActorId: d.organizationActorId,
    consumerId: d.consumerId
  });
