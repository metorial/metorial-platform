import { createLoader } from '@metorial/data-hooks';
import { useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let usersLoader = createLoader({
  name: 'users',
  fetch: (params: { tenantId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.user.list(params)),
  hash: params => `${params.tenantId}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useUsers = (tenantId: string | undefined) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = usersLoader.use(tenantId ? { tenantId, ...cursor } : null);

  let transformedData = useMemo(() => {
    if (!loader.data) return null;
    return {
      ...loader.data,
      pagination: {
        hasMoreAfter: loader.data.pagination.has_more_after,
        hasMoreBefore: loader.data.pagination.has_more_before
      }
    };
  }, [loader.data]);

  return {
    ...loader,
    data: transformedData,
    next: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ after: items[items.length - 1].id });
      }
    },
    previous: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ before: items[0].id });
      }
    }
  };
};

export let useCreateUser = usersLoader.createExternalMutator(
  (data: { tenantId: string; name: string; identifier: string }) =>
    withAuthRedirect(() => adminClient.user.create(data))
);

export let userLoader = createLoader({
  name: 'user',
  fetch: (params: { tenantId: string; userId: string }) =>
    withAuthRedirect(() => adminClient.user.get(params)),
  hash: params => `${params.tenantId}:${params.userId}`,
  mutators: {},
  parents: [usersLoader]
});

export let useUser = (tenantId: string | undefined, userId: string | undefined) =>
  userLoader.use(tenantId && userId ? { tenantId, userId } : null);

export let userTokensLoader = createLoader({
  name: 'userTokens',
  fetch: (params: { tenantId: string; userId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.user.token.list(params)),
  hash: params => `${params.tenantId}:${params.userId}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {},
  parents: [userLoader]
});

export let useUserTokens = (tenantId: string | undefined, userId: string | undefined) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = userTokensLoader.use(
    tenantId && userId ? { tenantId, userId, ...cursor } : null
  );

  let transformedData = useMemo(() => {
    if (!loader.data) return null;
    return {
      ...loader.data,
      pagination: {
        hasMoreAfter: loader.data.pagination.has_more_after,
        hasMoreBefore: loader.data.pagination.has_more_before
      }
    };
  }, [loader.data]);

  return {
    ...loader,
    data: transformedData,
    next: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ after: items[items.length - 1].id });
      }
    },
    previous: () => {
      let items = loader.data?.items;
      if (items?.length) {
        setCursor({ before: items[0].id });
      }
    }
  };
};

export let useCreateUserToken = userTokensLoader.createExternalMutator(
  (data: { tenantId: string; userId: string; name: string; expiresAt?: string }) =>
    withAuthRedirect(() => adminClient.user.token.create(data))
);

export let useRevokeUserToken = userTokensLoader.createExternalMutator(
  (data: { tenantId: string; userId: string; tokenId: string }) =>
    withAuthRedirect(() => adminClient.user.token.delete(data))
);
