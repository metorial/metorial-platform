import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useSandboxDisk, useSandboxMachine } from '@metorial/state';
import { Button, Callout, Dialog, NumberInput, Spacer, Text, showModal } from '@metorial/ui';
import { DiskStack, useSandboxDiskPaths } from '../disks/common';
import { formatBytes } from '../lib/format';

let gib = 1024 ** 3;

export let showSandboxResizeDiskDialog = ({
  disk: input
}: {
  disk: { id: string; sizeBytes?: number | null; size_bytes?: number | null };
}) =>
  showModal(({ dialogProps, close }) => {
    let paths = useSandboxDiskPaths();
    let disk = useSandboxDisk(paths.instanceId, input.id);
    let machine = useSandboxMachine(paths.instanceId, disk.data?.machine?.id);
    let resize = disk.useResizeMutator();
    let current = disk.data?.sizeBytes ?? input.sizeBytes ?? input.size_bytes ?? 0;
    let minimum = Math.floor(current / gib) + 1;
    let form = useForm({
      initialValues: { size: Math.ceil(current / gib) + 16 },
      updateInitialValues: true,
      schema: yup =>
        yup.object({
          size: yup
            .number()
            .integer('Use a whole number of GiB.')
            .min(minimum, `Pick a size larger than ${formatBytes(current)}.`)
            .required('Enter a size.')
        }),
      onSubmit: async values => {
        let [result] = await resize.mutate({ sizeBytes: values.size * gib });
        if (result) close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={480}>
        <Dialog.Title>Resize Disk</Dialog.Title>
        <Dialog.Description>
          Disks can only grow. The new size applies to the whole disk.
        </Dialog.Description>
        {renderWithLoader({ disk })(({ disk }) => (
          <form onSubmit={form.handleSubmit}>
            <DiskStack>
              <Text>Current Size: {formatBytes(disk.data.sizeBytes)}</Text>
              <NumberInput
                label="New Size"
                unit="GiB"
                value={form.values.size}
                min={minimum}
                step={1}
                onChange={value => form.setFieldValue('size', value)}
                presets={[
                  { label: '+16 GiB', value: Math.ceil(current / gib) + 16 },
                  { label: 'Double', value: Math.ceil(current / gib) * 2 },
                  { label: '+256 GiB', value: Math.ceil(current / gib) + 256 }
                ]}
              />
              <form.RenderError field="size" />
              <Callout variant="inline" color={disk.data.machine ? 'orange' : 'blue'}>
                {disk.data.machine
                  ? `${machine.data?.name || machine.data?.slug || disk.data.machine.id} will stop briefly while the disk grows, then start again on its own.`
                  : 'The disk is not attached to a machine, so it will resize quickly.'}
              </Callout>
              <resize.RenderError />
            </DiskStack>
            <Spacer size={20} />
            <Dialog.Actions>
              <Button
                size="2"
                type="button"
                variant="outline"
                disabled={resize.isLoading}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                size="2"
                type="submit"
                loading={resize.isLoading}
                success={resize.isSuccess}
                disabled={
                  !!disk.data.activeResize ||
                  disk.data.sizeBytes == null ||
                  disk.data.status !== 'active'
                }
              >
                Resize Disk
              </Button>
            </Dialog.Actions>
          </form>
        ))}
      </Dialog.Wrapper>
    );
  });
