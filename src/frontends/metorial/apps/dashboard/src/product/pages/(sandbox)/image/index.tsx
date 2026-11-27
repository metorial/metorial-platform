import { col, createDataList } from '@metorial/data-list';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useSandboxImage,
  useSandboxImageBuildsForImage,
  useSandboxImageVersions,
  useSandboxMachines,
  type DashboardInstanceSandboxMachinesListOutput
} from '@metorial/state';
import { Button, Callout, RenderDate } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { showSandboxImageBuildPanel } from '../../../scenes/sandbox/imageBuildPanel';
import {
  ImageStack,
  imageVersionLabel,
  useSandboxImagePaths
} from '../../../scenes/sandbox/images/common';
import { SandboxImageVersionsTable } from '../../../scenes/sandbox/images/versionsTable';
import { formatSpec } from '../../../scenes/sandbox/lib/format';
import {
  SandboxMachineStatusBadge,
  isSandboxBuildActive
} from '../../../scenes/sandbox/shared/statusBadges';

type ImageMachine = DashboardInstanceSandboxMachinesListOutput['items'][number] & {
  versionLabel?: string;
};

let ImageMachinesList = createDataList<{ imageId: string }>('sandbox-image-machines', {
  customizable: false
})
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useSandboxMachines(ctx.instanceId, { imageId: props.imageId, limit, order: 'desc' })
  )
  .enrich((machines, { props, ctx }) => {
    let versions = useSandboxImageVersions(ctx.instanceId, props.imageId, {
      limit: 100,
      order: 'desc'
    });

    let items = useMemo(
      () =>
        machines.map(machine => {
          let version = versions.data?.items.find(
            version => version.id === machine.image.versionId
          );

          return {
            ...machine,
            versionLabel: version
              ? imageVersionLabel(version)
              : machine.image.versionId?.slice(-8)
          } as ImageMachine;
        }),
      [machines, versions.data?.items]
    );

    return { items };
  })
  .columns([
    col.name<ImageMachine>({
      id: 'machine',
      header: 'Machine',
      get: machine => machine.name || machine.slug || machine.id,
      description: false
    }),
    col.custom<ImageMachine>({
      id: 'status',
      header: 'Status',
      render: machine => <SandboxMachineStatusBadge status={machine.status} />
    }),
    col.text<ImageMachine>({ id: 'version', header: 'Version', get: m => m.versionLabel }),
    col.text<ImageMachine>({
      id: 'size',
      header: 'Size',
      get: machine =>
        formatSpec(
          machine.spec ? { cpus: machine.spec.cpus, memory_gib: machine.spec.memoryGib } : null
        )
    })
  ])
  .link((machine, _props, ctx) =>
    Paths.instance.sandboxMachine(ctx.organization, ctx.project, ctx.instance, machine.id)
  )
  .build();

let ImageMachines = ({ imageId }: { imageId: string }) => {
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();

  return (
    <Box
      title="Machines using this image"
      rightActions={
        <Button size="1" variant="outline" onClick={() => navigate(paths.machines(imageId))}>
          View All
        </Button>
      }
    >
      <ImageMachinesList
        imageId={imageId}
        listVariant="preview"
        listLimit={5}
        emptyState="No machines use this image."
      />
    </Box>
  );
};

export let SandboxImageOverviewPage = () => {
  let { imageId } = useParams();
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let image = useSandboxImage(paths.instanceId, imageId);
  let builds = useSandboxImageBuildsForImage(
    paths.instanceId,
    image.data?.owner === 'own' ? imageId : null,
    { limit: 1, order: 'desc' }
  );
  let latest = builds.data?.items[0];
  return renderWithLoader({ image })(({ image }) => (
    <DetailsOverviewLayout>
      <ImageStack>
        {image.data.status === 'deleted' && (
          <Callout color="gray">This image has been deleted.</Callout>
        )}
        {image.data.owner === 'own' && image.data.status !== 'deleted' && (
          <>
            {latest && ['failed', 'timed_out'].includes(latest.status) ? (
              <Callout color="red">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                  <span style={{ flex: 1 }}>
                    {latest.failure?.message || 'The latest image build failed.'}{' '}
                  </span>
                  <Button
                    size="1"
                    variant="outline"
                    onClick={() => navigate(paths.version(image.data.id, latest.versionId))}
                  >
                    View Logs
                  </Button>{' '}
                  <Button
                    size="1"
                    onClick={() => showSandboxImageBuildPanel({ image: image.data })}
                  >
                    Try Again
                  </Button>
                </span>
              </Callout>
            ) : latest && isSandboxBuildActive(latest.status) ? (
              <Callout color="orange">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                  <span style={{ flex: 1 }}>
                    {imageVersionLabel({
                      id: latest.versionId,
                      versionNumber: latest.versionNumber
                    })}{' '}
                    is building. Started <RenderDate date={latest.createdAt} />.{' '}
                  </span>
                  <Button
                    size="1"
                    variant="outline"
                    onClick={() => navigate(paths.version(image.data.id, latest.versionId))}
                  >
                    View Logs
                  </Button>
                </span>
              </Callout>
            ) : !image.data.latestVersionId ? (
              <Callout color="gray">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                  <span style={{ flex: 1 }}>Upload a build context to create version 1.</span>
                  <Button
                    size="1"
                    onClick={() => showSandboxImageBuildPanel({ image: image.data })}
                  >
                    Start Build
                  </Button>
                </div>
              </Callout>
            ) : null}
          </>
        )}
        <Box
          title="Versions"
          rightActions={
            <Button
              size="1"
              variant="outline"
              onClick={() => navigate(paths.image(image.data.id, 'versions'))}
            >
              View All
            </Button>
          }
        >
          <SandboxImageVersionsTable
            imageId={image.data.id}
            owner={image.data.owner}
            limit={5}
            variant="preview"
          />
        </Box>

        <ImageMachines imageId={image.data.id} />
      </ImageStack>
    </DetailsOverviewLayout>
  ));
};
