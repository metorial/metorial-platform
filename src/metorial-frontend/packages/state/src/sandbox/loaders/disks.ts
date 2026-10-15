import type {
  DashboardInstanceSandboxDisksCloneBody,
  DashboardInstanceSandboxDisksCreateBody,
  DashboardInstanceSandboxDisksGetOutput,
  DashboardInstanceSandboxDisksListOutput,
  DashboardInstanceSandboxDisksListQuery,
  DashboardInstanceSandboxDisksMountsListQuery,
  DashboardInstanceSandboxDisksResizeBody,
  DashboardInstanceSandboxDisksResizesGetOutput,
  DashboardInstanceSandboxDisksResizesListOutput,
  DashboardInstanceSandboxDisksResizesListQuery,
  DashboardInstanceSandboxDisksUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { SandboxPollOptions, useSandboxPolling } from '../lib/polling';
import { isSandboxDiskBusy, isSandboxDiskResizeActive } from '../lib/status';

let DISKS_LIST_POLL_MS = 10_000;
let DISK_POLL_MS = 3_000;
let DISK_RESIZE_POLL_MS = 3_000;

type NoInput = void | Record<string, never>;

export let sandboxDisksLoader = createLoader({
  name: 'sandboxDisks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxDisksListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.sandbox.disks.list(instanceId, query);
    }),
  mutators: {}
});

export let useCreateSandboxDisk = sandboxDisksLoader.createExternalMutator(
  (i: DashboardInstanceSandboxDisksCreateBody & { instanceId: string }) =>
    withAuth(sdk => {
      let { instanceId, ...body } = i;
      return sdk.sandbox.disks.create(instanceId, body);
    })
);

export let useSandboxDisks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxDisksListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxDisksListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxDisksLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    `sandboxDisks:${instanceId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: page => (page.items.some(isSandboxDiskBusy) ? DISKS_LIST_POLL_MS : false)
  });

  return data;
};

export let sandboxDiskMountsLoader = createLoader({
  name: 'sandboxDiskMounts',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      diskId: string;
    } & DashboardInstanceSandboxDisksMountsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, diskId, ...query } = i;
      return sdk.sandbox.disks.mounts.list(instanceId, diskId, query);
    }),
  mutators: {}
});

export let useSandboxDiskMounts = (
  instanceId: string | null | undefined,
  diskId: string | null | undefined,
  query?: DashboardInstanceSandboxDisksMountsListQuery | null
) =>
  usePaginator(
    pagination =>
      sandboxDiskMountsLoader.use(
        instanceId && diskId && query !== null
          ? { instanceId, diskId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxDiskMounts:${instanceId}:${diskId}:${JSON.stringify(query ?? {})}`
  );

export let sandboxDiskResizesLoader = createLoader({
  name: 'sandboxDiskResizes',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      diskId: string;
    } & DashboardInstanceSandboxDisksResizesListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, diskId, ...query } = i;
      return sdk.sandbox.disks.resizes.list(instanceId, diskId, query);
    }),
  mutators: {}
});

export let useSandboxDiskResizes = (
  instanceId: string | null | undefined,
  diskId: string | null | undefined,
  query?: DashboardInstanceSandboxDisksResizesListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxDisksResizesListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxDiskResizesLoader.use(
        instanceId && diskId && query !== null
          ? { instanceId, diskId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxDiskResizes:${instanceId}:${diskId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: page =>
      page.items.some(isSandboxDiskResizeActive) ? DISK_RESIZE_POLL_MS : false
  });

  return data;
};

export let sandboxDiskLoader = createLoader({
  name: 'sandboxDisk',
  parents: [sandboxDisksLoader, sandboxDiskMountsLoader, sandboxDiskResizesLoader],
  fetch: (i: { instanceId: string; diskId: string }) =>
    withAuth(sdk => sdk.sandbox.disks.get(i.instanceId, i.diskId)),
  mutators: {
    update: async (
      body: DashboardInstanceSandboxDisksUpdateBody,
      { input: { instanceId, diskId }, setOutput }
    ) => {
      let disk = await withAuth(sdk => sdk.sandbox.disks.update(instanceId, diskId, body));
      setOutput(disk);

      return disk;
    },
    delete: async (_: NoInput, { input: { instanceId, diskId }, setOutput }) => {
      let disk = await withAuth(sdk => sdk.sandbox.disks.delete(instanceId, diskId));
      setOutput(disk);

      return disk;
    },
    resize: (
      body: DashboardInstanceSandboxDisksResizeBody,
      { input: { instanceId, diskId } }
    ) => withAuth(sdk => sdk.sandbox.disks.resize(instanceId, diskId, body)),
    clone: (body: DashboardInstanceSandboxDisksCloneBody, { input: { instanceId, diskId } }) =>
      withAuth(sdk => sdk.sandbox.disks.clone(instanceId, diskId, body))
  }
});

export let useSandboxDisk = (
  instanceId: string | null | undefined,
  diskId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxDisksGetOutput>
) => {
  let data = sandboxDiskLoader.use(instanceId && diskId ? { instanceId, diskId } : null);

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: disk => (isSandboxDiskBusy(disk) ? DISK_POLL_MS : false)
  });

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useResizeMutator: data.useMutator('resize'),
    useCloneMutator: data.useMutator('clone')
  };
};

export let sandboxDiskResizeLoader = createLoader({
  name: 'sandboxDiskResize',
  parents: [sandboxDiskLoader, sandboxDisksLoader, sandboxDiskResizesLoader],
  fetch: (i: { instanceId: string; diskId: string; resizeId: string }) =>
    withAuth(sdk => sdk.sandbox.disks.resizes.get(i.instanceId, i.diskId, i.resizeId)),
  mutators: {
    retry: (_: NoInput, { input: { instanceId, diskId, resizeId } }) =>
      withAuth(sdk => sdk.sandbox.disks.resizes.retry(instanceId, diskId, resizeId))
  }
});

export let useSandboxDiskResize = (
  instanceId: string | null | undefined,
  diskId: string | null | undefined,
  resizeId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxDisksResizesGetOutput>
) => {
  let data = sandboxDiskResizeLoader.use(
    instanceId && diskId && resizeId ? { instanceId, diskId, resizeId } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: resize =>
      isSandboxDiskResizeActive(resize) ? DISK_RESIZE_POLL_MS : false
  });

  return {
    ...data,
    useRetryMutator: data.useMutator('retry')
  };
};

export let useDeleteSandboxDiskFromList = sandboxDiskLoader.createExternalMutator(
  (input: { instanceId: string; diskId: string }) =>
    withAuth(sdk => sdk.sandbox.disks.delete(input.instanceId, input.diskId))
);
