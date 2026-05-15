import type { User } from '@metorial/db';
import {
  defaultInternalEnvironmentIdentifier,
  getUserServiceEnvironmentId,
  getUserServiceTenantId,
  getUserTenantIdentifier,
  persistUserScope,
  toScope
} from './shared';
import {
  upsertCargoEnvironment,
  upsertCargoTenant,
  upsertSynthesisEnvironment,
  upsertSynthesisTenant
} from './upsert';
import type { InternalScope } from './types';

export let ensureCargoUserScope = async (user: User): Promise<InternalScope> => {
  let tenantId = getUserServiceTenantId('cargo', user);
  let environmentId = getUserServiceEnvironmentId('cargo', user);
  let tenantIdentifier = getUserTenantIdentifier(user);

  if (tenantId && environmentId) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: defaultInternalEnvironmentIdentifier,
      tenantName: user.name,
      environmentName: 'Default',
      environmentType: 'production'
    });
  }

  if (!tenantId) {
    tenantId = (
      await upsertCargoTenant({
        identifier: tenantIdentifier,
        name: user.name
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

  await persistUserScope({
    service: 'cargo',
    user,
    tenantId,
    tenantIdentifier,
    environmentId
  });

  return toScope({
    tenantId,
    environmentId,
    tenantIdentifier,
    environmentIdentifier: defaultInternalEnvironmentIdentifier,
    tenantName: user.name,
    environmentName: 'Default',
    environmentType: 'production'
  });
};

export let ensureSynthesisUserScope = async (user: User): Promise<InternalScope> => {
  let tenantId = getUserServiceTenantId('synthesis', user);
  let environmentId = getUserServiceEnvironmentId('synthesis', user);
  let tenantIdentifier = getUserTenantIdentifier(user);

  if (tenantId && environmentId) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: defaultInternalEnvironmentIdentifier,
      tenantName: user.name,
      environmentName: 'Default',
      environmentType: 'production'
    });
  }

  if (!tenantId) {
    tenantId = (
      await upsertSynthesisTenant({
        identifier: tenantIdentifier,
        name: user.name
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

  await persistUserScope({
    service: 'synthesis',
    user,
    tenantId,
    tenantIdentifier,
    environmentId
  });

  return toScope({
    tenantId,
    environmentId,
    tenantIdentifier,
    environmentIdentifier: defaultInternalEnvironmentIdentifier,
    tenantName: user.name,
    environmentName: 'Default',
    environmentType: 'production'
  });
};
