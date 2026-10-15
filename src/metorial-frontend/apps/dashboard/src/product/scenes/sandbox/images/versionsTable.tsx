import { renderWithPagination } from '@metorial/data-hooks';
import {
  useSandboxImage,
  useSandboxImageBuildsForImage,
  useSandboxImageVersions
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { formatDurationBetween, formatEnumLabel } from '../lib/format';
import { SandboxBuildStatusBadge } from '../shared/statusBadges';
import { imageVersionLabel, useSandboxImagePaths } from './common';

export type ImageBuildFilter = 'all' | 'succeeded' | 'failed' | 'progress';

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

let OwnVersions = ({
  imageId,
  limit,
  status
}: {
  imageId: string;
  limit: number;
  status: ImageBuildFilter;
}) => {
  let paths = useSandboxImagePaths();
  let image = useSandboxImage(paths.instanceId, imageId);
  let builds = useSandboxImageBuildsForImage(paths.instanceId, imageId, {
    order: 'desc',
    limit,
    status: statusFilter(status)
  });
  return renderWithPagination(builds, {
    hidePaginationWhenUnavailable: true
  })(builds =>
    builds.data.items.length ? (
      <Table
        headers={['Version', 'Build Status', 'Duration', 'Regions', 'Created']}
        data={builds.data.items.map(build => ({
          href: paths.version(imageId, build.versionId),
          data: [
            <span>
              {imageVersionLabel({
                id: build.versionId,
                versionNumber: build.versionNumber
              })}{' '}
            </span>,
            <SandboxBuildStatusBadge status={build.status} />,
            formatDurationBetween(build.createdAt, build.endedAt),
            build.regions.map(region => `${region.region} · ${region.status}`).join(', ') ||
              '—',
            <RenderDate date={build.createdAt} />
          ]
        }))}
      />
    ) : (
      <Text size="2">No versions found. Start a build to create one.</Text>
    )
  );
};

let GlobalVersions = ({ imageId, limit }: { imageId: string; limit: number }) => {
  let paths = useSandboxImagePaths();
  let image = useSandboxImage(paths.instanceId, imageId);
  let versions = useSandboxImageVersions(paths.instanceId, imageId, { limit, order: 'desc' });
  return renderWithPagination(versions, {
    hidePaginationWhenUnavailable: true
  })(versions =>
    versions.data.items.length ? (
      <Table
        headers={['Version', 'Status', 'Regions', 'Created']}
        data={versions.data.items.map(version => [
          <span>{imageVersionLabel(version)}</span>,
          <Badge
            color={
              version.status === 'active'
                ? 'blue'
                : version.status === 'pending'
                  ? 'orange'
                  : 'gray'
            }
          >
            {formatEnumLabel(version.status)}
          </Badge>,
          version.regions.join(', ') || '—',
          <RenderDate date={version.createdAt} />
        ])}
      />
    ) : (
      <Text size="2">No versions available.</Text>
    )
  );
};

export let SandboxImageVersionsTable = ({
  imageId,
  owner,
  limit = 20,
  status = 'all'
}: {
  imageId: string;
  owner: 'own' | 'global';
  limit?: number;
  status?: ImageBuildFilter;
}) =>
  owner === 'own' ? (
    <OwnVersions imageId={imageId} limit={limit} status={status} />
  ) : (
    <GlobalVersions imageId={imageId} limit={limit} />
  );
