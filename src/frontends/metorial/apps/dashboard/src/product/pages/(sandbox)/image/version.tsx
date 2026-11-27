import { renderWithLoader } from '@metorial/data-hooks';
import { LogViewer } from '@metorial/log-viewer';
import {
  useFile,
  useSandboxImage,
  useSandboxImageBuild,
  useSandboxImageVersion,
  useStartSandboxImageBuild
} from '@metorial/state';
import { Attributes, Button, Callout, RenderDate, Text, Title, confirm } from '@metorial/ui';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { showSandboxImageBuildPanel } from '../../../scenes/sandbox/imageBuildPanel';
import {
  imageVersionLabel,
  useSandboxImagePaths
} from '../../../scenes/sandbox/images/common';
import { createSandboxImageBuildLogSource } from '../../../scenes/sandbox/images/logSource';
import { formatBytes, formatDurationBetween } from '../../../scenes/sandbox/lib/format';
import {
  SandboxBuildStatusBadge,
  isSandboxBuildActive
} from '../../../scenes/sandbox/shared/statusBadges';

let Viewport = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 320px;
  overflow: hidden;
`;

let LogSlot = styled.div`
  flex: 1;
  min-height: 0;
`;

let VersionBuild = ({ buildId, imageId }: { buildId: string; imageId: string }) => {
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let build = useSandboxImageBuild(paths.instanceId, buildId);
  let image = useSandboxImage(paths.instanceId, imageId);
  let contextFile = useFile(paths.instanceId, build.data?.fileId);

  let cancel = build.useCancelMutator();
  let rebuild = useStartSandboxImageBuild();
  let source = useMemo(
    () =>
      paths.instanceId ? createSandboxImageBuildLogSource(paths.instanceId, buildId) : null,
    [paths.instanceId, buildId]
  );

  let [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  let [height, setHeight] = useState(600);

  useLayoutEffect(() => {
    let measure = () => {
      if (viewport)
        setHeight(
          Math.max(320, window.innerHeight - viewport.getBoundingClientRect().top - 24)
        );
    };
    measure();
    window.addEventListener('resize', measure);
    let observer = new ResizeObserver(measure);
    if (viewport?.parentElement) observer.observe(viewport.parentElement);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [viewport]);

  return renderWithLoader({ build, image })(({ build, image }) => {
    let data = build.data;
    let active = isSandboxBuildActive(data.status);
    let cancellable = ['preparing', 'queued', 'building', 'processing'].includes(data.status);
    return (
      <Viewport ref={setViewport} style={{ height }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Title size="5" weight="strong">
              {imageVersionLabel({ id: data.versionId, versionNumber: data.versionNumber })}
            </Title>
            <SandboxBuildStatusBadge status={data.status} />
          </div>

          <div style={{ flex: 1 }} />
          {cancellable && (
            <Button
              size="2"
              variant="outline"
              loading={cancel.isLoading}
              success={cancel.isSuccess}
              onClick={() =>
                confirm({
                  title: 'Cancel Build',
                  description: 'Cancel this image build?',
                  confirmText: 'Cancel Build',
                  onConfirm: () => {
                    void cancel.mutate();
                  }
                })
              }
            >
              Cancel Build
            </Button>
          )}
          {!active && (
            <>
              <Button
                size="2"
                variant="outline"
                loading={rebuild.isLoading}
                success={rebuild.isSuccess}
                disabled={!data.fileId}
                onClick={async () => {
                  if (data.buildArgNames?.length) {
                    showSandboxImageBuildPanel({ image: image.data, previousBuild: data });
                    return;
                  }
                  if (!paths.instanceId || !data.fileId) return;
                  let [result] = await rebuild.mutate({
                    instanceId: paths.instanceId,
                    imageId,
                    fileId: data.fileId,
                    dockerfilePath: data.dockerfilePath || undefined,
                    contextPath: data.contextPath || undefined,
                    target: data.target || undefined,
                    timeoutSeconds: data.timeoutSeconds || undefined,
                    diskSizeBytes: data.diskSizeBytes || undefined
                  });
                  if (result) navigate(paths.version(imageId, result.versionId));
                }}
              >
                Rebuild
              </Button>
              <Button
                size="2"
                disabled={!image.data.latestVersionId || rebuild.isLoading}
                onClick={() => showSandboxCreateMachinePanel({ imageId })}
              >
                Create Machine
              </Button>
            </>
          )}
        </div>

        <cancel.RenderError />
        <rebuild.RenderError />

        {data.failure && <Callout color="red">{data.failure.message}</Callout>}

        <Attributes
          attributes={[
            {
              label: 'Duration',
              content: formatDurationBetween(data.createdAt, data.endedAt)
            },
            { label: 'Build Disk', content: formatBytes(data.diskSizeBytes) },
            {
              label: 'Context',
              content:
                contextFile.data?.fileName ||
                (data.contextUploadedAt ? (
                  <>
                    Uploaded <RenderDate date={data.contextUploadedAt} />
                  </>
                ) : (
                  'No uploaded context'
                ))
            }
          ]}
        />

        <LogSlot>
          {data.hasLogs && source ? (
            <LogViewer
              source={source}
              height="100%"
              pollIntervalMs={2000}
              emptyText="No logs for this build."
            />
          ) : (
            <Text size="2">
              {active
                ? 'Build logs will appear once the build starts.'
                : 'No logs for this build.'}
            </Text>
          )}
        </LogSlot>
      </Viewport>
    );
  });
};

export let SandboxImageVersionPage = () => {
  let { imageId, versionId } = useParams();
  let paths = useSandboxImagePaths();
  let version = useSandboxImageVersion(paths.instanceId, imageId, versionId, {
    pollInterval: data => (data?.buildId && data.status !== 'active' ? 3000 : false)
  });
  return renderWithLoader({ version })(({ version }) =>
    version.data.buildId ? (
      <VersionBuild
        key={version.data.buildId}
        buildId={version.data.buildId}
        imageId={imageId!}
      />
    ) : (
      <>
        <Title size="4">{imageVersionLabel(version.data)}</Title>
        <Attributes
          attributes={[
            { label: 'Status', content: version.data.status },
            { label: 'Regions', content: version.data.regions.join(', ') },
            { label: 'Created', content: <RenderDate date={version.data.createdAt} /> }
          ]}
        />
        <Text size="2">Build logs are unavailable for Metorial images.</Text>
      </>
    )
  );
};
