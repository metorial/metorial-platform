import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useChat, useCurrentInstance } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ChatChannelsTable } from '../../../scenes/chat/channelsTable';
import { ChatWorkspacesTable } from '../../../scenes/chat/workspacesTable';

export let ChatOverviewPage = () => {
  let instance = useCurrentInstance();
  let { chatId } = useParams();
  let chat = useChat(instance.data?.id, chatId);

  return renderWithLoader({ chat })(({ chat }) => (
    <DetailsOverviewLayout>
      <Box
        title="Channels"
        description="The channels and conversations this chat instance has access to."
      >
        <ChatChannelsTable instanceId={instance.data!.id} chatId={chat.data.id} />
      </Box>

      <Spacer height={20} />

      <Box
        title="Workspaces"
        description="The workspaces Metorial has synced for this chat instance."
      >
        <ChatWorkspacesTable
          instanceId={instance.data!.id}
          chatInstanceId={chat.data.chatInstanceId}
        />
      </Box>
    </DetailsOverviewLayout>
  ));
};
