import type { Organization } from '@metorial/db';
import {
  defaultInternalEnvironmentIdentifier,
  getOrganizationServiceEnvironmentId,
  getOrganizationServiceTenantId,
  getOrganizationTenantIdentifier,
  persistOrganizationScope,
  toScope
} from './shared';
import type { InternalScope } from './types';
import { upsertCargoEnvironment, upsertCargoTenant } from './upsert';

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
