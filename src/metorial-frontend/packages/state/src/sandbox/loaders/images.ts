import type {
  DashboardInstanceSandboxImageBuildsGetOutput,
  DashboardInstanceSandboxImageBuildsListOutput,
  DashboardInstanceSandboxImageBuildsListQuery,
  DashboardInstanceSandboxImagesBuildsCreateBody,
  DashboardInstanceSandboxImagesBuildsListQuery,
  DashboardInstanceSandboxImagesCreateBody,
  DashboardInstanceSandboxImagesGetOutput,
  DashboardInstanceSandboxImagesListOutput,
  DashboardInstanceSandboxImagesListQuery,
  DashboardInstanceSandboxImagesUpdateBody,
  DashboardInstanceSandboxImagesVersionsGetOutput,
  DashboardInstanceSandboxImagesVersionsListOutput,
  DashboardInstanceSandboxImagesVersionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { SandboxPollOptions, useSandboxPolling } from '../lib/polling';
import { isSandboxImageBuildActive } from '../lib/status';

let BUILDS_LIST_POLL_MS = 10_000;
let BUILD_POLL_MS = 3_000;

type NoInput = void | Record<string, never>;

export let sandboxImageVersionsLoader = createLoader({
  name: 'sandboxImageVersions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      imageId: string;
    } & DashboardInstanceSandboxImagesVersionsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, imageId, ...query } = i;
      return sdk.sandbox.images.versions.list(instanceId, imageId, query);
    }),
  mutators: {}
});

export let useSandboxImageVersions = (
  instanceId: string | null | undefined,
  imageId: string | null | undefined,
  query?: DashboardInstanceSandboxImagesVersionsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxImagesVersionsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxImageVersionsLoader.use(
        instanceId && imageId && query !== null
          ? { instanceId, imageId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxImageVersions:${instanceId}:${imageId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxImageVersionLoader = createLoader({
  name: 'sandboxImageVersion',
  parents: [sandboxImageVersionsLoader],
  fetch: (i: { instanceId: string; imageId: string; versionId: string }) =>
    withAuth(sdk => sdk.sandbox.images.versions.get(i.instanceId, i.imageId, i.versionId)),
  mutators: {}
});

export let useSandboxImageVersion = (
  instanceId: string | null | undefined,
  imageId: string | null | undefined,
  versionId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxImagesVersionsGetOutput>
) => {
  let data = sandboxImageVersionLoader.use(
    instanceId && imageId && versionId ? { instanceId, imageId, versionId } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxImageBuildsLoader = createLoader({
  name: 'sandboxImageBuilds',
  parents: [sandboxImageVersionsLoader, sandboxImageVersionLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxImageBuildsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.sandbox.imageBuilds.list(instanceId, query);
    }),
  mutators: {}
});

export let useSandboxImageBuilds = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxImageBuildsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxImageBuildsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxImageBuildsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    `sandboxImageBuilds:${instanceId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: page =>
      page.items.some(isSandboxImageBuildActive) ? BUILDS_LIST_POLL_MS : false
  });

  return data;
};

export let sandboxImageBuildsForImageLoader = createLoader({
  name: 'sandboxImageBuildsForImage',
  parents: [sandboxImageVersionsLoader, sandboxImageVersionLoader, sandboxImageBuildsLoader],
  fetch: (
    i: {
      instanceId: string;
      imageId: string;
    } & DashboardInstanceSandboxImagesBuildsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, imageId, ...query } = i;
      return sdk.sandbox.images.builds.list(instanceId, imageId, query);
    }),
  mutators: {}
});

export let useSandboxImageBuildsForImage = (
  instanceId: string | null | undefined,
  imageId: string | null | undefined,
  query?: DashboardInstanceSandboxImagesBuildsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxImageBuildsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxImageBuildsForImageLoader.use(
        instanceId && imageId && query !== null
          ? { instanceId, imageId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxImageBuildsForImage:${instanceId}:${imageId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: page =>
      page.items.some(isSandboxImageBuildActive) ? BUILDS_LIST_POLL_MS : false
  });

  return data;
};

export let sandboxImagesLoader = createLoader({
  name: 'sandboxImages',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxImagesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.sandbox.images.list(instanceId, query);
    }),
  mutators: {}
});

export let useCreateSandboxImage = sandboxImagesLoader.createExternalMutator(
  (i: DashboardInstanceSandboxImagesCreateBody & { instanceId: string }) =>
    withAuth(sdk => {
      let { instanceId, ...body } = i;
      return sdk.sandbox.images.create(instanceId, body);
    })
);

export let useSandboxImages = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxImagesListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxImagesListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxImagesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    `sandboxImages:${instanceId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxImageLoader = createLoader({
  name: 'sandboxImage',
  parents: [
    sandboxImagesLoader,
    sandboxImageVersionsLoader,
    sandboxImageVersionLoader,
    sandboxImageBuildsLoader,
    sandboxImageBuildsForImageLoader
  ],
  fetch: (i: { instanceId: string; imageId: string }) =>
    withAuth(sdk => sdk.sandbox.images.get(i.instanceId, i.imageId)),
  mutators: {
    update: async (
      body: DashboardInstanceSandboxImagesUpdateBody,
      { input: { instanceId, imageId }, setOutput }
    ) => {
      let image = await withAuth(sdk => sdk.sandbox.images.update(instanceId, imageId, body));
      setOutput(image);

      return image;
    },
    delete: async (_: NoInput, { input: { instanceId, imageId }, setOutput }) => {
      let image = await withAuth(sdk => sdk.sandbox.images.delete(instanceId, imageId));
      setOutput(image);

      return image;
    }
  }
});

export let useStartSandboxImageBuild = sandboxImageLoader.createExternalMutator(
  (
    i: DashboardInstanceSandboxImagesBuildsCreateBody & {
      instanceId: string;
      imageId: string;
    }
  ) =>
    withAuth(sdk => {
      let { instanceId, imageId, ...body } = i;
      return sdk.sandbox.images.builds.create(instanceId, imageId, body);
    })
);

export let useSandboxImage = (
  instanceId: string | null | undefined,
  imageId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxImagesGetOutput>
) => {
  let data = sandboxImageLoader.use(instanceId && imageId ? { instanceId, imageId } : null);

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let sandboxImageBuildLoader = createLoader({
  name: 'sandboxImageBuild',
  parents: [
    sandboxImageBuildsLoader,
    sandboxImageBuildsForImageLoader,
    sandboxImageVersionsLoader,
    sandboxImageVersionLoader,
    sandboxImageLoader,
    sandboxImagesLoader
  ],
  fetch: (i: { instanceId: string; buildId: string }) =>
    withAuth(sdk => sdk.sandbox.imageBuilds.get(i.instanceId, i.buildId)),
  mutators: {
    cancel: async (_: NoInput, { input: { instanceId, buildId }, setOutput }) => {
      let build = await withAuth(sdk => sdk.sandbox.imageBuilds.cancel(instanceId, buildId));
      setOutput(build);

      return build;
    }
  }
});

export let useSandboxImageBuild = (
  instanceId: string | null | undefined,
  buildId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxImageBuildsGetOutput>
) => {
  let data = sandboxImageBuildLoader.use(
    instanceId && buildId ? { instanceId, buildId } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: build => (isSandboxImageBuildActive(build) ? BUILD_POLL_MS : false)
  });

  return {
    ...data,
    useCancelMutator: data.useMutator('cancel')
  };
};

export let useDeleteSandboxImageFromList = sandboxImageLoader.createExternalMutator(
  (input: { instanceId: string; imageId: string }) =>
    withAuth(sdk => sdk.sandbox.images.delete(input.instanceId, input.imageId))
);
