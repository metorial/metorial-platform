import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCreateSandboxDisk,
  useDeleteSandboxDiskFromList,
  useSandboxDisk,
  useSandboxMachine,
  useSandboxRegions,
  useSandboxRegionSelection
} from '@metorial/state';
import {
  Button,
  confirm,
  Dialog,
  Input,
  Menu,
  NumberInput,
  Select,
  showModal,
  Spacer,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { RiMore2Line } from '@remixicon/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showSandboxResizeDiskDialog } from '../resizeDiskDialog';
import { DiskStack, SandboxDisk, useSandboxDiskPaths } from './common';

export let showSandboxCreateDiskDialog = () =>
  showModal(({ dialogProps, close }) => {
    let paths = useSandboxDiskPaths();
    let navigate = useNavigate();
    let regions = useSandboxRegions(paths.instanceId);
    let selection = useSandboxRegionSelection();
    let create = useCreateSandboxDisk();
    let form = useForm({
      initialValues: { name: '', region: '', size: 16 },
      schema: yup =>
        yup.object({
          name: yup.string(),
          region: yup.string().required('Choose a region.'),
          size: yup.number().integer('Use a whole number of GiB.').min(1).required()
        }),
      onSubmit: async values => {
        if (!paths.instanceId) return;
        let [disk] = await create.mutate({
          instanceId: paths.instanceId,
          name: values.name.trim() || undefined,
          region: values.region,
          sizeBytes: values.size * 1024 ** 3
        });
        if (!disk) return;

        selection.rememberRegion(values.region);
        close();
        navigate(paths.disk(disk.id));
      }
    });

    useEffect(() => {
      if (form.values.region) return;
      let region = selection.getRegion(regions.data?.items ?? []);
      if (region) void form.setFieldValue('region', region);
    }, [regions.data, form.values.region]);

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Create Disk</Dialog.Title>
        <Dialog.Description>
          Persistent storage that can be attached to machines.
        </Dialog.Description>
        {renderWithLoader({ regions })(({ regions }) => (
          <form onSubmit={form.handleSubmit}>
            <DiskStack>
              <Input label="Name" {...form.getFieldProps('name')} />
              <Select
                label="Region"
                value={form.values.region}
                onChange={value => {
                  selection.rememberRegion(value);
                  form.setFieldValue('region', value);
                }}
                items={regions.data.items
                  .filter(region => region.availability === 'available')
                  .map(region => ({
                    id: region.id,
                    label: region.name || region.id
                  }))}
              />
              <form.RenderError field="region" />
              <NumberInput
                label="Size"
                unit="GiB"
                value={form.values.size}
                min={1}
                step={1}
                onChange={value => form.setFieldValue('size', value)}
                presets={[16, 32, 64, 256].map(value => ({ value, label: `${value} GiB` }))}
              />
              <form.RenderError field="size" />
              <create.RenderError />
            </DiskStack>
            <Spacer size={20} />
            <Dialog.Actions>
              <Button
                size="2"
                type="button"
                variant="outline"
                disabled={create.isLoading}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                size="2"
                type="submit"
                loading={create.isLoading}
                success={create.isSuccess}
              >
                Create Disk
              </Button>
            </Dialog.Actions>
          </form>
        ))}
      </Dialog.Wrapper>
    );
  });

export let showSandboxCloneDiskDialog = ({ disk: input }: { disk: SandboxDisk }) =>
  showModal(({ dialogProps, close }) => {
    let paths = useSandboxDiskPaths();
    let navigate = useNavigate();
    let disk = useSandboxDisk(paths.instanceId, input.id);
    let clone = disk.useCloneMutator();
    let form = useForm({
      initialValues: { name: '' },
      onSubmit: async values => {
        let [result] = await clone.mutate({ name: values.name.trim() || undefined });
        if (!result) return;
        close();
        navigate(paths.disk(result.id));
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Clone Disk</Dialog.Title>
        <Dialog.Description>Create a copy in {input.region}.</Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <Spacer size={20} />
          <clone.RenderError />
          <Dialog.Actions>
            <Button
              size="2"
              type="button"
              variant="outline"
              disabled={clone.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              size="2"
              type="submit"
              disabled={!disk.data}
              loading={clone.isLoading}
              success={clone.isSuccess}
            >
              Clone Disk
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let SandboxDeleteDiskButton = ({ disk: input }: { disk: SandboxDisk }) => {
  let paths = useSandboxDiskPaths();
  let navigate = useNavigate();
  let disk = useSandboxDisk(paths.instanceId, input.id);
  let machine = useSandboxMachine(paths.instanceId, input.machine?.id);
  let remove = disk.useDeleteMutator();

  return (
    <>
      <Button
        size="2"
        color="red"
        loading={remove.isLoading}
        success={remove.isSuccess}
        onClick={() =>
          confirm({
            title: 'Delete Disk',
            description: input.machine
              ? `This disk will be detached from ${machine.data?.name || machine.data?.slug || input.machine.id} first, then permanently deleted.`
              : 'Permanently delete this disk and all its data?',
            confirmText: 'Delete Disk',
            onConfirm: async () => {
              let [result] = await remove.mutate();
              if (result) navigate(paths.disks);
            }
          })
        }
      >
        Delete Disk
      </Button>
      <remove.RenderError />
    </>
  );
};

export let SandboxDiskMenu = ({ disk: input }: { disk: SandboxDisk }) => {
  let copy = useCopy(input.id);
  let paths = useSandboxDiskPaths();
  let navigate = useNavigate();
  let remove = useDeleteSandboxDiskFromList();

  return (
    <div onClick={event => event.stopPropagation()}>
      <Menu
        items={[
          {
            id: 'resize',
            label: 'Resize',
            disabled:
              !!input.activeResize || input.sizeBytes == null || input.status !== 'active'
          },
          { id: 'clone', label: 'Clone Disk', disabled: input.status !== 'active' },
          { id: 'copy', label: 'Copy ID' },
          {
            id: 'delete',
            label:
              input.type === 'root_fs' ? (
                <Tooltip content="Root disks are deleted with their machine">
                  <span>Delete Disk</span>
                </Tooltip>
              ) : (
                'Delete Disk'
              ),
            description:
              input.type === 'root_fs'
                ? 'Root disks are deleted with their machine.'
                : undefined,
            disabled: input.type === 'root_fs' || input.status !== 'active' || remove.isLoading
          }
        ]}
        onItemClick={id => {
          if (id === 'resize') showSandboxResizeDiskDialog({ disk: input });
          if (id === 'clone') showSandboxCloneDiskDialog({ disk: input });
          if (id === 'copy') copy.copy();
          if (id === 'delete')
            confirm({
              title: 'Delete Disk',
              description: input.machine
                ? `This disk will be detached from ${input.machine.name || input.machine.slug || input.machine.id} first, then permanently deleted.`
                : 'Permanently delete this disk and all its data?',
              confirmText: 'Delete Disk',
              onConfirm: async () => {
                let [result] = await remove.mutate({
                  instanceId: paths.instanceId!,
                  diskId: input.id
                });
                if (result) navigate(paths.disks);
              }
            });
        }}
      >
        <Button
          variant="outline"
          size="2"
          iconLeft={<RiMore2Line />}
          title="Disk Actions"
          loading={remove.isLoading}
          success={remove.isSuccess}
        />
      </Menu>
      <remove.RenderError />
    </div>
  );
};
