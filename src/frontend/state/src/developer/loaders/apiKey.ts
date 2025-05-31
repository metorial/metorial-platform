import { createLoader } from '@metorial/data-hooks';
import {
  ApiKeysCreateBody,
  ApiKeysListQuery,
  ApiKeysUpdateBody
} from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useState } from 'react';
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

export let apiKeyLoader = createLoader({
  name: 'apiKey',
  fetch: (i: { apiKeyId: string }) => withAuth(sdk => sdk.apiKeys.get(i.apiKeyId)),
  mutators: {}
});

export let useApiKey = (apiKeyId: string | null | undefined) => {
  let apiKey = apiKeyLoader.use(apiKeyId ? { apiKeyId } : null);

  return {
    ...apiKey
  };
};

let revealedApiKey: Record<
  string,
  {
    secret: string;
    ts: number;
  }
> = {};
let getCachedRevealedApiKey = (apiKeyId: string) => {
  let cached = revealedApiKey[apiKeyId];
  if (!cached) return;
  if (Date.now() - cached.ts > 1000 * 60 * 30) {
    delete revealedApiKey[apiKeyId];
    return;
  }
  return cached;
};
let useApiReveal = apiKeyLoader.createExternalMutator(({ apiKeyId }: { apiKeyId: string }) =>
  withAuth(sdk => sdk.apiKeys.reveal(apiKeyId))
);

export let useRevealableApiKey = ({ apiKeyId }: { apiKeyId: string }) => {
  let [value, setValue] = useState<string | undefined>(
    () => getCachedRevealedApiKey(apiKeyId)?.secret
  );
  let revealMutator = useApiReveal();

  let reveal = () => {
    let cached = getCachedRevealedApiKey(apiKeyId);
    if (cached) {
      setValue(cached.secret);
      return;
    }

    revealMutator
      .mutate({
        apiKeyId
      })
      .then(async ([res]) => {
        if (!res) return;
        revealedApiKey[apiKeyId] = {
          secret: res.secret!,
          ts: Date.now()
        };
        setValue(res?.secret!);
      });
  };

  let hide = () => {
    setValue(undefined);
  };

  return {
    value,
    isLoading: revealMutator.isLoading,

    reveal,
    hide
  };
};
