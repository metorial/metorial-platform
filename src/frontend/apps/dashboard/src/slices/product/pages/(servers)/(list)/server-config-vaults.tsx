import { CodeEditor } from '@metorial/code-editor';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreateServerConfigVault,
  useCurrentInstance,
  useServerConfigVault,
  useServerConfigVaults
} from '@metorial/state';
import {
  Button,
  Dialog,
  Flex,
  Input,
  Menu,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { RiMoreLine } from '@remixicon/react';

export let ServerConfigVaultsPage = () => {
  let instance = useCurrentInstance();
  let vaults = useServerConfigVaults(instance.data?.id);

  return renderWithPagination(vaults)(vaults => (
    <>
      <Table
        headers={['Info', 'ID', 'Created', '']}
        data={vaults.data.items.map(vault => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {vault.name}
              </Text>
              <Text size="1" color="gray600" truncate>
                {vault.description}
              </Text>
            </Flex>,
            <ID id={vault.id} />,
            <RenderDate date={vault.createdAt} />,
            <Menu
              items={[
                {
                  id: 'update',
                  label: 'Update'
                }
              ]}
              onItemClick={item => {
                if (item == 'update') showUpdateServerConfigVaultModal({ vaultId: vault.id });
              }}
            >
              <Button size="1" variant="outline" iconLeft={<RiMoreLine />} title="Actions" />
            </Menu>
          ]
        }))}
      />

      {vaults.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No config vaults for this instance.
        </Text>
      )}
    </>
  ));
};

export let showCreateSeverConfigVaultsModal = () =>
  showModal(({ dialogProps, close }) => {
    let instance = useCurrentInstance();
    let create = useCreateServerConfigVault();

    let form = useForm({
      initialValues: {
        name: '',
        description: '',
        config: '{}'
      },
      onSubmit: async values => {
        if (!instance.data) return;

        let [res] = await create.mutate({
          instanceId: instance.data.id,
          name: values.name,
          description: values.description,
          config: JSON.parse(values.config)
        });
        if (res) setTimeout(() => close(), 300);
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string(),
          config: yup
            .string()
            .required('Config is required')
            .test('is-json', 'Config must be valid JSON', value => {
              try {
                JSON.parse(value || '');
                return true;
              } catch {
                return false;
              }
            })
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Server Config Vault</Dialog.Title>
        <Dialog.Description>
          Config vaults allow you to securely store and manage reusable configuration data for
          your MCP servers.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <CodeEditor
            height="100px"
            value={form.values.config}
            onChange={v => form.setFieldValue('config', v)}
            label="Config (JSON)"
            lang="json"
          />
          <form.RenderError field="config" />

          <Spacer size={15} />

          <Button type="submit" size="2" loading={create.isLoading} success={create.isSuccess}>
            Create
          </Button>
        </form>
      </Dialog.Wrapper>
    );
  });

export let showUpdateServerConfigVaultModal = (p: { vaultId: string }) =>
  showModal(({ dialogProps, close }) => {
    let instance = useCurrentInstance();
    let vault = useServerConfigVault(instance.data?.id, p.vaultId);
    let updateMutator = vault.useUpdateMutator();

    let form = useForm({
      initialValues: {
        name: vault.data?.name || '',
        description: vault.data?.description || ''
      },
      updateInitialValues: true,
      onSubmit: async values => {
        if (!instance.data) return;

        let [res] = await updateMutator.mutate({
          name: values.name,
          description: values.description
        });
        if (res) setTimeout(() => close(), 300);
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Update Server Config Vault</Dialog.Title>
        <Dialog.Description>
          Update the details of your server config vault.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Button
            type="submit"
            size="2"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Update
          </Button>
        </form>
      </Dialog.Wrapper>
    );
  });
