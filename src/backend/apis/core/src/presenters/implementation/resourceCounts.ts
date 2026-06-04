import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { resourceCountsType } from '../types';

export let resourceCountResourceValues = [
  'provider_deployments',
  'provider_configs',
  'provider_config_vaults',
  'provider_auth_configs',
  'provider_auth_credentials',
  'session_templates',
  'networks',
  'firewalls',
  'enclaves',
  'accounts',
  'agents',
  'identity_actors',
  'identities',
  'identity_delegations',
  'identity_delegation_configs'
] as const;

export type ResourceCountResource = (typeof resourceCountResourceValues)[number];

export let resourceCountResourceValidator = v.enumOf([...resourceCountResourceValues]);

export let v1ResourceCountsPresenter = Presenter.create(resourceCountsType)
  .presenter(async ({ resources }) => ({
    object: 'resource_counts' as const,
    resources
  }))
  .schema(
    v.object({
      object: v.literal('resource_counts'),
      resources: v.array(
        v.object({
          resource: resourceCountResourceValidator,
          count: v.number()
        })
      )
    })
  )
  .build();
