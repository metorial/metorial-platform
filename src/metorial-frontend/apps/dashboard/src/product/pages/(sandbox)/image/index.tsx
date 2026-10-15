import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import {
  useSandboxImage,
  useSandboxImageBuildsForImage,
  useSandboxImageVersions,
  useSandboxMachines
} from '@metorial/state';
import { Button, Callout, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
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

let ImageMachines = ({ imageId }: { imageId: string }) => {
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let machines = useSandboxMachines(paths.instanceId, { imageId, limit: 5, order: 'desc' });
  let versions = useSandboxImageVersions(paths.instanceId, imageId, {
    limit: 100,
    order: 'desc'
  });
  return (
    <Box
      title="Machines using this image"
      rightActions={
        <Button size="1" variant="outline" onClick={() => navigate(paths.machines(imageId))}>
          View All
        </Button>
      }
    >
      {renderWithPagination(machines, {
        hidePaginationWhenUnavailable: true
      })(machines =>
        machines.data.items.length ? (
          <Table
            headers={['Machine', 'Status', 'Version', 'Size']}
            data={machines.data.items.map(machine => ({
              href: paths.machine(machine.id),
              data: [
                machine.name || machine.slug || machine.id,
                <SandboxMachineStatusBadge status={machine.status} />,
                (() => {
                  let version = versions.data?.items.find(
                    version => version.id === machine.image.versionId
                  );
                  return version
                    ? imageVersionLabel(version)
                    : machine.image.versionId?.slice(-8) || '—';
                })(),
                formatSpec(
                  machine.spec
                    ? { cpus: machine.spec.cpus, memory_gib: machine.spec.memoryGib }
                    : null
                )
              ]
            }))}
          />
        ) : (
          <Text size="2">No machines use this image.</Text>
        )
      )}
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
          />
        </Box>

        <ImageMachines imageId={image.data.id} />
      </ImageStack>
    </DetailsOverviewLayout>
  ));
};
