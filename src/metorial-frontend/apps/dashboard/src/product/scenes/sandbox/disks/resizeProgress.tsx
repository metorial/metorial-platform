import { renderWithLoader } from '@metorial/data-hooks';
import { useSandboxDiskResize } from '@metorial/state';
import {
  Callout,
  Flex,
  ProgressSteps,
  RenderDate,
  Text,
  getProgressStepStates
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useRef, useState } from 'react';
import { formatBytes, formatEnumLabel } from '../lib/format';
import { DiskMachineLink, DiskStack, type SandboxDisk, useSandboxDiskPaths } from './common';

export let SandboxDiskResizeProgress = ({
  disk,
  embedded
}: {
  disk: SandboxDisk;
  embedded?: boolean;
}) => {
  let paths = useSandboxDiskPaths();
  let [resizeId, setResizeId] = useState(disk.activeResize?.id);
  let [completed, setCompleted] = useState(false);
  let observedActive = useRef(!!disk.activeResize);
  let resize = useSandboxDiskResize(paths.instanceId, disk.id, resizeId);

  useEffect(() => {
    if (!disk.activeResize) return;
    observedActive.current = true;
    setResizeId(disk.activeResize.id);
    setCompleted(false);
  }, [disk.activeResize?.id]);

  useEffect(() => {
    if (resize.data?.status !== 'complete' || !observedActive.current) return;
    setCompleted(true);
    let timer = setTimeout(() => {
      setCompleted(false);
      observedActive.current = false;
      setResizeId(undefined);
    }, 5000);
    return () => clearTimeout(timer);
  }, [resize.data?.status, resize.data?.id]);

  if (completed && resize.data)
    return (
      <Callout color="blue">Resized to {formatBytes(resize.data.targetSizeBytes)}</Callout>
    );
  if (!disk.activeResize) return null;

  return renderWithLoader({ resize })(({ resize }) => {
    let stages = ['pending', 'draining', 'resizing', 'verifying', 'restarting'];
    let states = getProgressStepStates(stages, resize.data.status);

    let content = (
      <DiskStack>
        <ProgressSteps
          steps={stages.map(id => ({
            id,
            label: formatEnumLabel(id),
            state: states[id]
          }))}
        />
        {resize.data.machineIds.map(id => (
          <Text key={id}>
            <DiskMachineLink id={id} /> is stopped while the disk grows. It restarts on its own
            when the resize finishes.
          </Text>
        ))}
      </DiskStack>
    );
    let title = `Resizing ${formatBytes(resize.data.originalSizeBytes)} → ${formatBytes(resize.data.targetSizeBytes)}`;

    return embedded ? (
      <Flex direction="column" gap={15}>
        <Text weight="strong">{title}</Text>
        {content}
      </Flex>
    ) : (
      <Box
        title={title}
        description={
          <>
            Started <RenderDate date={resize.data.createdAt} />
          </>
        }
      >
        {content}
      </Box>
    );
  });
};
