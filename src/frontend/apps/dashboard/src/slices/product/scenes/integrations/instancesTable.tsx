import { useForm, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationInstance,
  IntegrationPreview,
  useCreateIntegrationInstance,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIntegrationInstance,
  useIntegrationInstances
} from '@metorial/state';
import {
  Button,
  Dialog,
  Flex,
  Input,
  Menu,
  RenderDate,
  Spacer,
  Text,
  confirm,
  showModal
} from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';

export let showIntegrationInstanceFormModal = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  onCreate?: (integrationInstance: IntegrationInstance) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createInstance = useCreateIntegrationInstance();
    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [created] = await createInstance.mutate({
          instanceId: p.instanceId,
          integrationId: p.integration.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
        if (!created) return;
        p.onCreate?.(created);
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Create Instance</Dialog.Title>
        <Dialog.Description>Create an instance of {p.integration.name}.</Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={10} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={15} />
          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createInstance.isPending}>
              Create Instance
            </Button>
          </Dialog.Actions>
          <createInstance.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

export let IntegrationInstancesTable = (p: {
  instanceId: string;
  integration: IntegrationPreview;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let instances = useIntegrationInstances(p.instanceId, {
    integrationId: p.integration.id,
    status: ['draft', 'active', 'archived']
  });
  let deleteInstance = useDeleteIntegrationInstance();

  return renderWithPagination(instances)(instances => (
    <>
      <Table
        headers={['Name', 'Providers', 'Status', 'Created', '']}
        data={instances.data.items.map((integrationInstance: IntegrationInstance) => ({
          onClick: () =>
            navigate(
              Paths.instance.integrationInstance(
                organization.data,
                project.data,
                instance.data,
                integrationInstance.id
              )
            ),
          data: [
            <Flex direction="column" gap={2}>
              <Text size="2" weight="strong">
                {integrationInstance.name}
              </Text>
              <ID id={integrationInstance.id} />
            </Flex>,
            <Text size="2">{integrationInstance.providers?.length ?? 0} providers</Text>,
            <Text size="2">{integrationInstance.status}</Text>,
            integrationInstance.createdAt ? (
              <RenderDate date={integrationInstance.createdAt} />
            ) : null,
            <div
              onClick={event => {
                event.stopPropagation();
                event.preventDefault();
              }}
            >
              <Menu
                items={[
                  { id: 'open', label: 'Open full' },
                  { id: 'delete', label: 'Delete' }
                ]}
                onItemClick={id => {
                  if (id === 'open') {
                    navigate(
                      Paths.instance.integrationInstance(
                        organization.data,
                        project.data,
                        instance.data,
                        integrationInstance.id
                      )
                    );
                  }

                  if (id === 'delete') {
                    confirm({
                      title: 'Delete instance',
                      description: `Delete ${integrationInstance.name}?`,
                      confirmText: 'Delete',
                      onConfirm: async () => {
                        await deleteInstance.mutate({
                          instanceId: p.instanceId,
                          integrationInstanceId: integrationInstance.id
                        });
                        instances.refetch();
                      }
                    });
                  }
                }}
              >
                <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
              </Menu>
            </div>
          ]
        }))}
      />

      {instances.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No instances have been created for this integration yet.
        </Text>
      )}
    </>
  ));
};
