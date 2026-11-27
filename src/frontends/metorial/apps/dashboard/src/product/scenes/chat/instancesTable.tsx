import {
  col,
  createDataList,
  deleteAction,
  EmptyValue,
  f,
  lifecycleStatusWithDraft,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useChatInstances, useDeleteChatInstance } from '@metorial/state';
import { Avatar, Flex, Text } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';

let ChatInstancesList = createDataList<{
  instanceId: string;
  chatConnectionId: string;
}>('chat-instances')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatusWithDraft),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search chat instances…')
  .paginated(({ props, filters, search, limit }) =>
    useChatInstances(
      props.instanceId,
      withDefaults(
        {
          chatConnectionId: props.chatConnectionId,
          order: 'desc' as const,
          status: ['draft' as const, 'active' as const],
          limit
        },
        { ...filters, search }
      )
    )
  )
  .columns([
    col.name(),
    col.status(lifecycleStatusWithDraft, { isDefault: false }),
    col.custom({
      id: 'identity',
      header: 'Identity',
      render: row => {
        if (!row.identity) return <EmptyValue>Not connected</EmptyValue>;

        let name = row.identity.name || row.identity.username;

        return (
          <Flex align="center" gap={8}>
            <Avatar
              entity={{ name, photoUrl: row.identity.imageUrl ?? undefined }}
              size={24}
              noTooltip
            />
            <Text size="2">{name}</Text>
          </Flex>
        );
      }
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.chatInstance(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Chat Instance',
      name: row => row.name,
      useMutate: () => useDeleteChatInstance(),
      input: (row, { props }) => ({
        instanceId: props.instanceId,
        chatInstanceId: row.id
      })
    })
  ])
  .build();

export let ChatInstancesTable = (p: Parameters<typeof ChatInstancesList>[0]) => (
  <ChatInstancesList
    emptyState="No instances have been created for this chat connection yet."
    {...p}
  />
);
