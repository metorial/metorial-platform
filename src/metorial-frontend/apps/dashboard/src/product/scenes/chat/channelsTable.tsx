import { Cases } from '@lowerdeck/case';
import { renderWithPagination } from '@metorial/data-hooks';
import { useChatChannels } from '@metorial/state';
import { Button, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { RiArrowRightLine } from '@remixicon/react';
import { useChatExplorerPath } from '../../components/openChatExplorer';

export let ChatChannelsTable = (p: { instanceId: string; chatId: string }) => {
  let channels = useChatChannels(p.instanceId, p.chatId, { order: 'desc' });
  let chatExplorerPath = useChatExplorerPath();

  return renderWithPagination(channels, { hidePaginationWhenUnavailable: true })(channels => (
    <>
      <Table
        headers={['Name', 'Type', 'ID', '']}
        data={channels.data.items.map(channel => ({
          href: chatExplorerPath({ chatId: p.chatId, channelId: channel.id }),
          data: [
            <Text size="2" weight="strong">
              {channel.name ?? channel.providerChannelId}
            </Text>,
            (
              {
                dm: 'Direct Message',
                group_dm: 'Group DM'
              } as any
            )[channel.type] ?? Cases.toTitleCase(channel.type),
            <ID id={channel.id} />,
            <Button
              size="1"
              variant="outline"
              as="span"
              iconRight={<RiArrowRightLine size={13} />}
            >
              Open in Explorer
            </Button>
          ]
        }))}
      />

      {channels.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No channels have been synced for this chat yet.
        </Text>
      )}
    </>
  ));
};
