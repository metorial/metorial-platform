import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreatePortalConsumerAccess,
  useCurrentInstance,
  useMagicMcpServers,
  usePortalConsumerAccess,
  usePortalConsumerGroups,
  useProviderTemplates
} from '@metorial/state';
import {
  Button,
  Dialog,
  Entity,
  RenderDate,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { getPortalTargetLabel, getPortalTargetTypeLabel } from './shared';

let AccessList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let showCreateConsumerAccessModal = (props: {
  instanceId: string;
  portalId: string;
  onCreate: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createAccess = useCreatePortalConsumerAccess();
    let groups = usePortalConsumerGroups(props.instanceId, props.portalId, { limit: 100 });
    let providerTemplates = useProviderTemplates(props.instanceId, { limit: 100 });
    let magicMcpServers = useMagicMcpServers(props.instanceId, { limit: 100 });

    let groupItems = (groups.data?.items ?? []).map(group => ({
      id: group.id,
      label: group.name
    }));
    let providerTemplateItems = (providerTemplates.data?.items ?? []).map(item => ({
      id: item.id,
      label: item.name
    }));
    let magicMcpServerItems = (magicMcpServers.data?.items ?? []).map(item => ({
      id: item.id,
      label: item.name ?? item.id
    }));
    let typeItems = [
      { id: 'provider_template', label: 'Provider Template' },
      { id: 'magic_mcp_server', label: 'Magic MCP Server' }
    ];

    let getPreferredTargetType = () => {
      if (providerTemplateItems.length > 0) return 'provider_template';
      if (magicMcpServerItems.length > 0) return 'magic_mcp_server';
      return 'provider_template';
    };

    let getTargetItems = (type: 'provider_template' | 'magic_mcp_server') =>
      type == 'provider_template' ? providerTemplateItems : magicMcpServerItems;

    let form = useForm({
      initialValues: {
        consumerGroupId: '',
        type: getPreferredTargetType(),
        targetId: ''
      },
      schema: yup =>
        yup.object({
          consumerGroupId: yup.string().required('Choose a consumer group'),
          type: yup.string().required(),
          targetId: yup.string().required('Choose a target')
        }),
      onSubmit: async values => {
        let access =
          values.type == 'provider_template'
            ? ({
                type: 'provider_template' as const,
                providerTemplateId: values.targetId
              })
            : ({
                type: 'magic_mcp_server' as const,
                magicMcpServerId: values.targetId
              });

        let [created] = await createAccess.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerGroupId: values.consumerGroupId,
          access
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    useEffect(() => {
      if (form.values.consumerGroupId || !groupItems[0]?.id) return;
      form.setFieldValue('consumerGroupId', groupItems[0].id);
    }, [form, groupItems]);

    useEffect(() => {
      let nextType = form.values.type as 'provider_template' | 'magic_mcp_server';
      let currentTargetItems = getTargetItems(nextType);

      if (currentTargetItems.length === 0) {
        nextType = getPreferredTargetType();
        currentTargetItems = getTargetItems(nextType);
      }

      let nextTargetId = currentTargetItems[0]?.id ?? '';
      let hasCurrentTarget = currentTargetItems.some(item => item.id == form.values.targetId);

      if (nextType != form.values.type) {
        form.setFieldValue('type', nextType);
      }

      if (!hasCurrentTarget && nextTargetId != form.values.targetId) {
        form.setFieldValue('targetId', nextTargetId);
      }
    }, [
      form,
      form.values.targetId,
      form.values.type,
      magicMcpServerItems,
      providerTemplateItems
    ]);

    let targetItems = getTargetItems(
      form.values.type as 'provider_template' | 'magic_mcp_server'
    );

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Consumer Access Rule</Dialog.Title>
        <Dialog.Description>
          Grant a consumer group access to a provider template or Magic MCP server.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Select
            label="Consumer Group"
            value={form.values.consumerGroupId}
            items={groupItems}
            onChange={value => form.setFieldValue('consumerGroupId', value)}
          />
          <form.RenderError field="consumerGroupId" />

          <Spacer size={15} />

          <Select
            label="Target Type"
            value={form.values.type}
            items={typeItems}
            onChange={value => {
              form.setFieldValue('type', value);
              form.setFieldValue(
                'targetId',
                getTargetItems(value as 'provider_template' | 'magic_mcp_server')[0]?.id ?? ''
              );
            }}
          />

          <Spacer size={15} />

          <Select
            label="Target"
            value={form.values.targetId}
            items={targetItems}
            onChange={value => form.setFieldValue('targetId', value)}
          />
          <form.RenderError field="targetId" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createAccess.isLoading}
              disabled={!groupItems.length || !targetItems.length}
            >
              Create Access Rule
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalConsumerAccessPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let access = usePortalConsumerAccess(instance.data?.id, portalId);

  if (!portalId) return null;

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      <Button
        onClick={() =>
          showCreateConsumerAccessModal({
            instanceId: instance.data.id,
            portalId,
            onCreate: () => access.refetch()
          })
        }
      >
        Create Access Rule
      </Button>

      <Spacer size={15} />

      {renderWithPagination(access, {
        hidePaginationWhenUnavailable: true
      })(access => (
        <AccessList>
          {access.data.items.map(item => (
            <Entity.Wrapper key={item.id}>
              <Entity.Content>
                <Entity.Field
                  title={getPortalTargetLabel(item.access)}
                  value={getPortalTargetTypeLabel(item.access)}
                />
                <Entity.Field title="Consumer Group" value={item.consumerGroup.name} />
                <Entity.Field title="Created" value={<RenderDate date={item.createdAt} />} />
              </Entity.Content>
            </Entity.Wrapper>
          ))}

          {access.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No explicit access rules exist for this portal yet.
            </Text>
          )}
        </AccessList>
      ))}
    </>
  ));
};
