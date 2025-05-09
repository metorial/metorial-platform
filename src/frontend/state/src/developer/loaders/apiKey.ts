import { ApiKeysCreateBody, ApiKeysListQuery, ApiKeysUpdateBody } from '@metorial/core';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';

export let apiKeysLoader = createLoader({
  name: 'apiKeys',
  parents: [],
  fetch: (i: ApiKeysListQuery) =>
    withAuth(sdk => autoPaginate(cursor => sdk.apiKeys.list({ ...i, ...cursor }))),
  mutators: {
    create: (i: ApiKeysCreateBody) => withAuth(sdk => sdk.apiKeys.create(i)),
    update: (i: ApiKeysUpdateBody & { apiKeyId: string }) =>
      withAuth(sdk => sdk.apiKeys.update(i.apiKeyId, i)),
    revoke: (i: { apiKeyId: string }) => withAuth(sdk => sdk.apiKeys.revoke(i.apiKeyId)),
    rotate: (i: { apiKeyId: string; currentExpiresAt?: Date }) =>
      withAuth(sdk =>
        sdk.apiKeys.rotate(i.apiKeyId, {
          currentExpiresAt: i.currentExpiresAt
        })
      )
  }
});

export type ApiKeysFilter =
  | {
      type: 'organization_management_token';
      organizationId: string;
    }
  | {
      type: 'user_auth_token';
    }
  | {
      type: 'instance_access_token';
      instanceId: string;
    };

export let useApiKeys = (input: ApiKeysFilter | null | undefined) => {
  let apiKeys = apiKeysLoader.use(input ?? null);

  return {
    ...apiKeys,
    createMutator: apiKeys.useMutator('create'),
    updateMutator: apiKeys.useMutator('update'),
    revokeMutator: apiKeys.useMutator('revoke'),
    rotateMutator: apiKeys.useMutator('rotate')
  };
};
