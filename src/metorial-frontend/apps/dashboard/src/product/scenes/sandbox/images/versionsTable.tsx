import { col, createDataList, defineStatus } from '@metorial/data-list';
import type {
  DashboardInstanceSandboxImageBuildsListOutput,
  DashboardInstanceSandboxImagesVersionsListOutput
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useSandboxImageBuildsForImage, useSandboxImageVersions } from '@metorial/state';
import { useInstanceContext } from '../../../lib/dataList';
import { formatDurationBetween } from '../lib/format';
import { SandboxBuildStatusBadge } from '../shared/statusBadges';
import { imageVersionLabel } from './common';

export type ImageBuildFilter = 'all' | 'succeeded' | 'failed' | 'progress';

type Build = DashboardInstanceSandboxImageBuildsListOutput['items'][number];
type Version = DashboardInstanceSandboxImagesVersionsListOutput['items'][number];

let statusFilter = (status: ImageBuildFilter) =>
  status === 'all'
    ? undefined
    : status === 'succeeded'
      ? ['succeeded' as const]
      : status === 'failed'
        ? ['failed' as const, 'timed_out' as const, 'cancelled' as const]
        : [
            'preparing' as const,
            'queued' as const,
            'building' as const,
            'processing' as const,
            'replicating' as const
          ];

let versionStatus = defineStatus({
  active: { label: 'Active', color: 'blue' },
  pending: { label: 'Pending', color: 'orange' },
  deleted: { label: 'Deleted', color: 'gray' }
});

type OwnVersionsProps = { imageId: string; status: ImageBuildFilter };

let OwnVersionsList = createDataList<OwnVersionsProps>('sandbox-image-builds', {
  customizable: false
})
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useSandboxImageBuildsForImage(ctx.instanceId, props.imageId, {
      order: 'desc',
      limit,
      status: statusFilter(props.status)
    })
  )
  .columns([
    col.text<Build>({
      id: 'version',
      header: 'Version',
      get: build =>
        imageVersionLabel({ id: build.versionId, versionNumber: build.versionNumber })
    }),
    col.custom<Build>({
      id: 'status',
      header: 'Build Status',
      render: build => <SandboxBuildStatusBadge status={build.status} />
    }),
    col.text<Build>({
      id: 'duration',
      header: 'Duration',
      get: build => formatDurationBetween(build.createdAt, build.endedAt)
    }),
    col.text<Build>({
      id: 'regions',
      header: 'Regions',
      get: build =>
        build.regions.map(region => `${region.region} · ${region.status}`).join(', ')
    }),
    col.createdAt<Build>()
  ])
  .link((build, props, ctx) =>
    Paths.instance.sandboxImageVersion(
      ctx.organization,
      ctx.project,
      ctx.instance,
      props.imageId,
      build.versionId
    )
  )
  .build();

let GlobalVersionsList = createDataList<{ imageId: string }>('sandbox-image-versions', {
  customizable: false
})
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useSandboxImageVersions(ctx.instanceId, props.imageId, { limit, order: 'desc' })
  )
  .columns([
    col.text<Version>({
      id: 'version',
      header: 'Version',
      get: version => imageVersionLabel(version)
    }),
    col.status<Version, 'active' | 'pending' | 'deleted'>(versionStatus),
    col.text<Version>({
      id: 'regions',
      header: 'Regions',
      get: version => version.regions.join(', ')
    }),
    col.createdAt<Version>()
  ])
  .build();

export let SandboxImageVersionsTable = ({
  imageId,
  owner,
  limit = 20,
  status = 'all',
  variant = 'embedded'
}: {
  imageId: string;
  owner: 'own' | 'global';
  limit?: number;
  status?: ImageBuildFilter;
  variant?: 'embedded' | 'preview';
}) =>
  owner === 'own' ? (
    <OwnVersionsList
      imageId={imageId}
      status={status}
      listVariant={variant}
      listLimit={limit}
      emptyState="No versions found. Start a build to create one."
    />
  ) : (
    <GlobalVersionsList
      imageId={imageId}
      listVariant={variant}
      listLimit={limit}
      emptyState="No versions available."
    />
  );
