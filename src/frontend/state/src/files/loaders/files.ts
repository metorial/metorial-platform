import type {
  DashboardInstanceFileLinksCreateBody,
  DashboardInstanceFilesGetOutput,
  DashboardInstanceFilesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type ManagedFile = DashboardInstanceFilesGetOutput;

export let filesLoader = createLoader({
  name: 'files',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceFilesListQuery) =>
    withAuth(sdk => sdk.files.list(i.instanceId, i)),
  mutators: {}
});

export let useUploadFile = filesLoader.createExternalMutator(
  (i: {
    instanceId: string;
    file: File | Blob;
    purpose: string;
    title?: string;
    store?: {
      id: string;
      path: string;
    };
  }) => withAuth(sdk => sdk.files.upload(i))
);

export let useCreateFileLink = filesLoader.createExternalMutator(
  (i: DashboardInstanceFileLinksCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.files.links.create(i.instanceId, i))
);

export let useFiles = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceFilesListQuery | null
) => {
  return usePaginator(
    pagination =>
      filesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ?? null
  );
};

export let fileLoader = createLoader({
  name: 'file',
  parents: [filesLoader],
  fetch: (i: { instanceId: string; fileId: string }) =>
    withAuth(sdk => sdk.files.get(i.instanceId, i.fileId)),
  mutators: {
    delete: (
      _: void,
      { input: { instanceId, fileId } }: { input: { instanceId: string; fileId: string } }
    ) => withAuth(sdk => sdk.files.delete(instanceId, fileId))
  }
});

export let useFile = (
  instanceId: string | null | undefined,
  fileId: string | null | undefined
) => {
  let data = fileLoader.use(instanceId && fileId ? { instanceId, fileId } : null);

  return {
    ...data,
    deleteMutator: data.useMutator('delete')
  };
};
