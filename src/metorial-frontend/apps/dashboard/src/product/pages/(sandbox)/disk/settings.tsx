import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import { useSandboxDisk } from '@metorial/state';
import { Button, Flex, Input, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  DiskMachineLink,
  DiskStack,
  useSandboxDiskPaths
} from '../../../scenes/sandbox/disks/common';
import { SandboxDeleteDiskButton } from '../../../scenes/sandbox/disks/actions';
import { showSandboxResizeDiskDialog } from '../../../scenes/sandbox/resizeDiskDialog';
import { formatBytes } from '../../../scenes/sandbox/lib/format';

export let SandboxDiskSettingsPage = () => {
  let paths = useSandboxDiskPaths();
  let { diskId } = useParams();
  let disk = useSandboxDisk(paths.instanceId, diskId);
  let update = disk.useUpdateMutator();
  let form = useForm({
    initialValues: { name: disk.data?.name || '' },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ name: values.name.trim() || null });
    }
  });

  return renderWithLoader({ disk })(({ disk }) => (
    <DetailsSettingsLayout>
      <DiskStack>
        <Box title="General">
          <form onSubmit={form.handleSubmit}>
            <Flex direction="column" gap={15}>
              <Input
                label="Name"
                {...form.getFieldProps('name')}
                disabled={disk.data.status === 'deleted'}
              />
              <Button
                style={{ alignSelf: 'flex-start' }}
                size="2"
                type="submit"
                loading={update.isLoading}
                success={update.isSuccess}
                disabled={disk.data.status === 'deleted' || !form.canSubmit}
              >
                Save
              </Button>
              <update.RenderError />
            </Flex>
          </form>
        </Box>
        <Box title="Size">
          <Flex direction="column" gap={15}>
            <Text>Current Size: {formatBytes(disk.data.sizeBytes)}</Text>
            {disk.data.status !== 'deleted' && (
              <Button
                style={{ alignSelf: 'flex-start' }}
                size="2"
                variant="outline"
                disabled={
                  !!disk.data.activeResize ||
                  disk.data.status !== 'active' ||
                  disk.data.sizeBytes == null
                }
                onClick={() => showSandboxResizeDiskDialog({ disk: disk.data })}
              >
                Resize Disk
              </Button>
            )}
          </Flex>
        </Box>
        {disk.data.status !== 'deleted' && (
          <Box title="Danger Zone">
            {disk.data.type === 'root_fs' ? (
              <Text>
                Root disks are deleted with their machine.
                {disk.data.machine && (
                  <>
                    {' '}
                    <DiskMachineLink id={disk.data.machine.id} settings />
                  </>
                )}
              </Text>
            ) : (
              <SandboxDeleteDiskButton disk={disk.data} />
            )}
          </Box>
        )}
      </DiskStack>
    </DetailsSettingsLayout>
  ));
};
