import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useChats } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';

let ChatsList = createDataList<{
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
}>('chats')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search chats…')
  .paginated(({ props, filters, search, limit }) =>
    useChats(
      props.instanceId,
      withDefaults(
        {
          chatConnectionId: props.chatConnectionId,
          chatInstanceId: props.chatInstanceId,
          order: 'desc' as const,
          status: ['active' as const],
          limit
        },
        { ...filters, search }
      )
    )
  )
  .columns([
    col.name({ description: false }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.refId('chatInstanceId', row => row.chatInstanceId, { header: 'Instance' }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.chat(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let ChatsTable = (p: Parameters<typeof ChatsList>[0]) => (
  <ChatsList emptyState="No chats have been synced yet." {...p} />
);
