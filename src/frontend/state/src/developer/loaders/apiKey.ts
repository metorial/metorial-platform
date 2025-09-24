import {
  ApiKeysCreateBody,
  ApiKeysListQuery,
  ApiKeysUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useState } from 'react';
import { autoPaginate } from '../../lib/autoPaginate';
import { useCurrentOrganization } from '../../organization';
import { withAuth } from '../../user';

export let apiKeysLoader = createLoader({
  name: 'apiKeys',
  parents: [],
  fetch: (i: ApiKeysListQuery & { organizationId: string }) =>
    withAuth(sdk =>
      autoPaginate(cursor => sdk.apiKeys.list(i.organizationId, { ...i, ...cursor }))
    ),
  mutators: {
    create: (i: ApiKeysCreateBody, { input }) =>
      withAuth(sdk => sdk.apiKeys.create(input.organizationId, i)),
    update: (i: ApiKeysUpdateBody & { apiKeyId: string }, { input }) =>
      withAuth(sdk => sdk.apiKeys.update(input.organizationId, i.apiKeyId, i)),
    revoke: (i: { apiKeyId: string }, { input }) =>
      withAuth(sdk => sdk.apiKeys.revoke(input.organizationId, i.apiKeyId)),
    rotate: (i: { apiKeyId: string; currentExpiresAt?: Date }, { input }) =>
      withAuth(sdk =>
        sdk.apiKeys.rotate(input.organizationId, i.apiKeyId, {
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
      type: 'instance_access_token';
      instanceId: string;
    };

export let useApiKeys = (input: ApiKeysFilter | null | undefined) => {
  let organization = useCurrentOrganization();
  let apiKeys = apiKeysLoader.use(
    input && organization.data
      ? {
          ...input,
          organizationId: organization.data.id
        }
      : null
  );

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
  fetch: (i: { apiKeyId: string; organizationId: string }) =>
    withAuth(sdk => sdk.apiKeys.get(i.organizationId, i.apiKeyId)),
  mutators: {}
});

export let useApiKey = (apiKeyId: string | null | undefined) => {
  let organization = useCurrentOrganization();
  let apiKey = apiKeyLoader.use(
    apiKeyId && organization.data
      ? {
          apiKeyId,
          organizationId: organization.data.id
        }
      : null
  );

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
let useApiReveal = apiKeyLoader.createExternalMutator(
  ({ apiKeyId, organizationId }: { apiKeyId: string; organizationId: string }) =>
    withAuth(sdk => sdk.apiKeys.reveal(organizationId, apiKeyId))
);

export let useRevealableApiKey = ({ apiKeyId }: { apiKeyId?: string }) => {
  let organization = useCurrentOrganization();

  let [value, setValue] = useState<string | undefined>(() =>
    apiKeyId ? getCachedRevealedApiKey(apiKeyId)?.secret : undefined
  );
  let revealMutator = useApiReveal();

  let reveal = () => {
    if (!apiKeyId || !organization.data) {
      setValue(undefined);
      return;
    }

    let cached = getCachedRevealedApiKey(apiKeyId);
    if (cached) {
      setValue(cached.secret);
      return;
    }

    revealMutator
      .mutate({
        apiKeyId,
        organizationId: organization.data.id
      })
      .then(async ([res]: any) => {
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

export let useRevealedApiKey = ({ apiKeyId }: { apiKeyId?: string }) => {
  let reveal = useRevealableApiKey({ apiKeyId });

  useEffect(() => {
    if (!reveal.value && apiKeyId) reveal.reveal();
  }, [reveal.value, apiKeyId]);

  return reveal;
};
