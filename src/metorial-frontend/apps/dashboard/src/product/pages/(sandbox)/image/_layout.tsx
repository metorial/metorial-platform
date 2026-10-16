import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout, type DetailsLayoutAction } from '@metorial/details-layout';
import {
  useSandboxImage,
  useSandboxImageBuildsForImage,
  useSandboxImageVersion
} from '@metorial/state';
import { Button, RenderDate, Tooltip, toast } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiStackLine } from '@remixicon/react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { showSandboxImageBuildPanel } from '../../../scenes/sandbox/imageBuildPanel';
import {
  useConfirmSandboxImageDeletion,
  useSandboxImagePaths
} from '../../../scenes/sandbox/images/common';
import { isSandboxBuildActive } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage } from '../_gate';

let SandboxImageDetailsLayout = () => {
  let { imageId } = useParams();
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let builds = useSandboxImageBuildsForImage(paths.instanceId, imageId, {
    limit: 1,
    order: 'desc'
  });
  let busy = isSandboxBuildActive(builds.data?.items[0]?.status);
  let image = useSandboxImage(paths.instanceId, imageId, {
    pollInterval: data => (busy || data?.status === 'pending' ? 3000 : false)
  });
  let latestVersion = useSandboxImageVersion(
    paths.instanceId,
    imageId,
    image.data?.latestVersionId
  );

  let remove = image.useDeleteMutator();
  let deletion = useConfirmSandboxImageDeletion({
    instanceId: paths.instanceId,
    imageId: imageId!,
    onDelete: async () => {
      let [result] = await remove.mutate();
      if (result) navigate(paths.images());
    }
  });

  let own = image.data?.owner === 'own';
  let data = image.data;

  let actions: DetailsLayoutAction[] = data
    ? [
        ...(own
          ? [
              {
                label: 'New Version',
                variant: 'outline' as const,
                onClick: () => showSandboxImageBuildPanel({ image: data })
              }
            ]
          : []),
        {
          type: 'custom',
          render: () => (
            <Tooltip
              content={
                data.latestVersionId
                  ? 'Create a machine using this image'
                  : 'Build a version before creating a machine'
              }
            >
              <span>
                <Button
                  size="2"
                  disabled={!data.latestVersionId}
                  onClick={() => showSandboxCreateMachinePanel({ imageId: data.id })}
                >
                  Create Machine
                </Button>
              </span>
            </Tooltip>
          )
        },
        {
          type: 'menu',
          label: 'More',
          loading: remove.isLoading || deletion.isLoading,
          success: remove.isSuccess,
          items: [
            { id: 'copy', label: 'Copy ID' },
            ...(own
              ? [
                  { id: 'rename', label: 'Rename' },
                  { id: 'delete', label: 'Delete Image' }
                ]
              : [])
          ],
          onItemClick: item => {
            if (item === 'copy')
              void navigator.clipboard
                .writeText(data.id)
                .then(() => toast.success('Copied to clipboard'));
            if (item === 'rename') navigate(paths.image(data.id, 'settings'));
            if (item === 'delete') void deletion.mutate();
          }
        }
      ]
    : [];

  return (
    <DetailsLayout
      entity={
        data
          ? {
              ...data,
              name: data.name || data.identifier,
              description: own ? 'Custom image' : data.identifier
            }
          : undefined
      }
      icon={<RiStackLine />}
      breadcrumbs={[
        { label: 'Machine Images', to: paths.images() },
        {
          label: data ? data.name || data.identifier || data.id : undefined,
          to: paths.image(imageId!)
        }
      ]}
      tabs={[
        { label: 'Overview', to: paths.image(imageId!) },
        { label: 'Versions', to: paths.image(imageId!, 'versions') },
        ...(own ? [{ label: 'Settings', to: paths.image(imageId!, 'settings') }] : [])
      ]}
      actions={data?.status === 'deleted' ? [] : actions}
      attributes={
        data
          ? [
              ...(!own ? [{ label: 'Managed by', value: 'Metorial' }] : []),
              { label: 'Status', value: data.status },
              {
                label: 'Latest Version',
                value: data.latestVersionId ? (
                  <Link to={paths.version(data.id, data.latestVersionId)}>
                    {latestVersion.data?.versionNumber != null
                      ? `Version ${latestVersion.data.versionNumber}`
                      : data.latestVersionId.slice(-8)}
                  </Link>
                ) : (
                  'No version'
                )
              },
              { label: 'Regions', value: data.regions.join(', ') || '—' },
              { label: 'Created', value: <RenderDate date={data.createdAt} /> },
              { label: 'Updated', value: <RenderDate date={data.updatedAt} /> },
              { label: 'ID', value: <ID id={data.id} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ image })(() => (
          <>
            <remove.RenderError />
            <deletion.RenderError />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};

export let SandboxImageLayout = () => (
  <SandboxManagedPage withLayout>
    <SandboxImageDetailsLayout />
  </SandboxManagedPage>
);
