import { Cases } from '@lowerdeck/case';
import { col, createDataList } from '@metorial/data-list';
import { useChatChannels } from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowRightLine } from '@remixicon/react';
import { useChatExplorerPath } from '../../components/openChatExplorer';

let channelTypeLabels: Record<string, string> = {
  dm: 'Direct Message',
  group_dm: 'Group DM'
};

let ChatChannelsList = createDataList<{ instanceId: string; chatId: string }>('chat-channels')
  .context(() => ({ chatExplorerPath: useChatExplorerPath() }))
  .paginated(({ props }) => useChatChannels(props.instanceId, props.chatId, { order: 'desc' }))
  .columns([
    col.text({
      id: 'name',
      header: 'Name',
      weight: 'strong',
      get: row => row.name ?? row.providerChannelId
    }),
    col.text({
      id: 'type',
      header: 'Type',
      get: row => channelTypeLabels[row.type] ?? Cases.toTitleCase(row.type)
    }),
    col.id({ isDefault: true }),
    col.custom({
      id: 'explorer',
      header: '',
      render: () => (
        <Button
          size="1"
          variant="outline"
          as="span"
          iconRight={<RiArrowRightLine size={13} />}
        >
          Open in Explorer
        </Button>
      )
    })
  ])
  .link((row, props, ctx) => ctx.chatExplorerPath({ chatId: props.chatId, channelId: row.id }))
  .build();

export let ChatChannelsTable = (p: { instanceId: string; chatId: string }) => (
  <ChatChannelsList
    {...p}
    listVariant="embedded"
    hideToolbar
    emptyState="No channels have been synced for this chat yet."
  />
);
