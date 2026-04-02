import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreatePortalConsumerAccess,
  useCurrentInstance,
  useMagicMcpServers,
  usePortalConsumerAccess,
  useProviderTemplates
} from '@metorial/state';
import {
  Button,
  Dialog,
  Flex,
  Menu,
  RenderDate,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useEffect } from 'react';
import { getPortalTargetLabel, getPortalTargetTypeLabel } from '../../pages/portal/shared';

let showCreatePortalAccessModal = (props: {
  instanceId: string;
  portalId: string;
  consumerGroupId: string;
  type: 'provider_template' | 'magic_mcp_server';
  onCreate: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createAccess = useCreatePortalConsumerAccess();
    let providerTemplates = useProviderTemplates(props.instanceId, { limit: 100 });
    let magicMcpServers = useMagicMcpServers(props.instanceId, { limit: 100 });
    let targetItems =
      props.type == 'provider_template'
        ? (providerTemplates.data?.items ?? []).map(item => ({
            id: item.id,
            label: item.name
          }))
        : (magicMcpServers.data?.items ?? []).map(item => ({
            id: item.id,
            label: item.name ?? item.id
          }));

    let form = useForm({
      initialValues: {
        targetId: targetItems[0]?.id ?? ''
      },
      updateInitialValues: true,
      schema: yup =>
        yup.object({
          targetId: yup.string().required('Choose a target')
        }),
      onSubmit: async values => {
        let [created] = await createAccess.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerGroupId: props.consumerGroupId,
          access:
            props.type == 'provider_template'
              ? {
                  type: 'provider_template',
                  providerTemplateId: values.targetId
                }
              : {
                  type: 'magic_mcp_server',
                  magicMcpServerId: values.targetId
                }
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    useEffect(() => {
      if (targetItems.length === 0) return;
      if (!form.values.targetId || !targetItems.some(item => item.id === form.values.targetId)) {
        form.setFieldValue('targetId', targetItems[0]?.id ?? '');
      }
    }, [form, form.values.targetId, targetItems]);

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>
          Add {props.type == 'provider_template' ? 'Provider Template' : 'Magic MCP Server'} Access
        </Dialog.Title>
        <Dialog.Description>
          Grant this consumer group access to a{' '}
          {props.type == 'provider_template' ? 'provider template' : 'Magic MCP server'}.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Select
            label={props.type == 'provider_template' ? 'Provider Template' : 'Magic MCP Server'}
            value={form.values.targetId}
            items={targetItems}
            onChange={value => form.setFieldValue('targetId', value)}
          />
          <form.RenderError field="targetId" />

          {targetItems.length === 0 && (
            <>
              <Spacer size={15} />
              <Text size="2" color="gray600">
                {props.type == 'provider_template'
                  ? 'No provider templates are available yet.'
                  : 'No Magic MCP servers are available yet.'}
              </Text>
            </>
          )}

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createAccess.isLoading} disabled={!targetItems.length}>
              Add Access
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalGroupAccess = (props: {
  portalId: string;
  groupId: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => {
  let instance = useCurrentInstance();
  let access = usePortalConsumerAccess(instance.data?.id, props.portalId, {
    consumerGroupId: props.groupId,
    limit: 100
  });
  let deleteAccess = access.deleteMutator();

  let accessContent = renderWithPagination(access, {
    hidePaginationWhenUnavailable: true
  })(accessPage => (
    <>
      <Table
        headers={['Resource', 'Type', 'Created', '']}
        data={accessPage.data.items.map(item => ({
          data: [
            getPortalTargetLabel(item.access),
            getPortalTargetTypeLabel(item.access),
            <RenderDate date={item.createdAt} />,
            <Flex justify="end" style={{ width: '100%' }}>
              <Button
                size="1"
                variant="outline"
                loading={
                  deleteAccess.isLoading && deleteAccess.input?.consumerAccessId === item.id
                }
                onClick={async () => {
                  let [removed] = await deleteAccess.mutate({
                    consumerAccessId: item.id
                  });

                  if (removed) {
                    access.refetch();
                  }
                }}
              >
                Remove
              </Button>
            </Flex>
          ]
        }))}
      />

      {accessPage.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No explicit access rules exist for this group.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(({ instance }) => (
    <Box
      title={props.title ?? 'Provider Access'}
      description={
        props.description ??
        'Choose which provider templates and Magic MCP servers members of this group can access.'
      }
      rightActions={
        <Menu
          items={[
            {
              id: 'provider_template',
              label: 'Provider Template',
              description: 'Grant access to a reusable provider template'
            },
            {
              id: 'magic_mcp_server',
              label: 'Magic MCP Server',
              description: 'Grant access to an existing Magic MCP server'
            }
          ]}
          onItemClick={id =>
            showCreatePortalAccessModal({
              instanceId: instance.data.id,
              portalId: props.portalId,
              consumerGroupId: props.groupId,
              type: id as 'provider_template' | 'magic_mcp_server',
              onCreate: () => access.refetch()
            })
          }
        >
          <Button size="2">Add Access</Button>
        </Menu>
      }
    >
      {accessContent}
    </Box>
  ));
};
