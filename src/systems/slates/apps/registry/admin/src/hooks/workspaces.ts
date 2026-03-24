import { createLoader } from '@metorial-io/data-hooks';
import { useMemo, useState } from 'react';
import { adminClient, withAuthRedirect } from './client';

export let workspacesLoader = createLoader({
  name: 'workspaces',
  fetch: (params: { tenantId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.workspace.list(params)),
  hash: params => `${params.tenantId}:${params.after ?? ''}:${params.before ?? ''}`,
  mutators: {}
});

export let useWorkspaces = (tenantId: string | undefined) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});

  let loader = workspacesLoader.use(tenantId ? { tenantId, ...cursor } : null);

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

export let workspaceLoader = createLoader({
  name: 'workspace',
  fetch: (params: { tenantId: string; workspaceId: string }) =>
    withAuthRedirect(() => adminClient.workspace.get(params)),
  hash: params => `${params.tenantId}:${params.workspaceId}`,
  mutators: {},
  parents: [workspacesLoader]
});

export let useWorkspace = (tenantId: string | undefined, workspaceId: string) =>
  workspaceLoader.use(tenantId && workspaceId ? { tenantId, workspaceId } : null);

export let useCreateWorkspace = workspacesLoader.createExternalMutator(
  (data: { tenantId: string; name: string; identifier: string; description?: string }) =>
    withAuthRedirect(() => adminClient.workspace.create(data))
);

export let useUpdateWorkspace = workspaceLoader.createExternalMutator(
  (data: { tenantId: string; workspaceId: string; name?: string; description?: string }) =>
    withAuthRedirect(() => adminClient.workspace.update(data))
);
