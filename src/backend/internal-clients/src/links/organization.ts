import type { Organization } from '@metorial/db';
import {
  defaultInternalEnvironmentIdentifier,
  getOrganizationServiceEnvironmentId,
  getOrganizationServiceTenantId,
  getOrganizationTenantIdentifier,
  persistOrganizationScope,
  toScope
} from './shared';
import {
  upsertCargoEnvironment,
  upsertCargoTenant,
  upsertSynthesisEnvironment,
  upsertSynthesisTenant
} from './upsert';
import type { InternalScope } from './types';

export let ensureCargoOrganizationScope = async (
  organization: Organization
): Promise<InternalScope> => {
  let tenantId = getOrganizationServiceTenantId('cargo', organization);
  let environmentId = getOrganizationServiceEnvironmentId('cargo', organization);
  let tenantIdentifier = getOrganizationTenantIdentifier(organization);

  if (tenantId && environmentId) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: defaultInternalEnvironmentIdentifier,
      tenantName: organization.name,
      environmentName: 'Default',
      environmentType: 'production'
    });
  }

  if (!tenantId) {
    tenantId = (
      await upsertCargoTenant({
        identifier: tenantIdentifier,
        name: organization.name
      })
    ).id;
  }

  if (!environmentId) {
    environmentId = (
      await upsertCargoEnvironment({
        tenantId,
        identifier: defaultInternalEnvironmentIdentifier,
        name: 'Default',
        type: 'production'
      })
    ).id;
  }

  await persistOrganizationScope({
    service: 'cargo',
    organization,
    tenantId,
    tenantIdentifier,
    environmentId
  });

  return toScope({
    tenantId,
    environmentId,
    tenantIdentifier,
    environmentIdentifier: defaultInternalEnvironmentIdentifier,
    tenantName: organization.name,
    environmentName: 'Default',
    environmentType: 'production'
  });
};

export let ensureSynthesisOrganizationScope = async (
  organization: Organization
): Promise<InternalScope> => {
  let tenantId = getOrganizationServiceTenantId('synthesis', organization);
  let environmentId = getOrganizationServiceEnvironmentId('synthesis', organization);
  let tenantIdentifier = getOrganizationTenantIdentifier(organization);

  if (tenantId && environmentId) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: defaultInternalEnvironmentIdentifier,
      tenantName: organization.name,
      environmentName: 'Default',
      environmentType: 'production'
    });
  }

  if (!tenantId) {
    tenantId = (
      await upsertSynthesisTenant({
        identifier: tenantIdentifier,
        name: organization.name
      })
    ).id;
  }

  if (!environmentId) {
    environmentId = (
      await upsertSynthesisEnvironment({
        tenantId,
        identifier: defaultInternalEnvironmentIdentifier,
        name: 'Default',
        type: 'production'
      })
    ).id;
  }

  await persistOrganizationScope({
    service: 'synthesis',
    organization,
    tenantId,
    tenantIdentifier,
    environmentId
  });

  return toScope({
    tenantId,
    environmentId,
    tenantIdentifier,
    environmentIdentifier: defaultInternalEnvironmentIdentifier,
    tenantName: organization.name,
    environmentName: 'Default',
    environmentType: 'production'
  });
};
