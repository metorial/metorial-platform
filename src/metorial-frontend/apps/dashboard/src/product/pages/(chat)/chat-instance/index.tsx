import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import {
  useChatInstance,
  useChatInstanceProvider,
  useChats,
  useCurrentInstance
} from '@metorial/state';
import { Button, Datalist, Spacer, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ChatsTable } from '../../../scenes/chat/chatsTable';
import {
  ChatInstanceConnectedAsSection,
  showChatInstanceProviderConfigPanelFlow
} from '../../../scenes/chat/instanceConfigPanel';

export let ChatInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { chatInstanceId } = useParams();
  let chatInstance = useChatInstance(instance.data?.id, chatInstanceId);
  let chatInstanceProvider = useChatInstanceProvider(instance.data?.id, chatInstance.data?.id);
  let chats = useChats(instance.data?.id, {
    chatInstanceId,
    limit: 10,
    order: 'desc',
    status: ['active']
  });

  return renderWithLoader({ chatInstance, chats })(({ chatInstance, chats }) => (
    <DetailsOverviewLayout>
      <ChatInstanceConnectedAsSection
        instanceId={instance.data!.id}
        chatInstanceId={chatInstance.data.id}
      />

      <Spacer height={20} />

      <Box
        title="Configuration"
        description="The provider config and chat account auth this instance uses."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showChatInstanceProviderConfigPanelFlow({
                instanceId: instance.data!.id,
                chatInstanceId: chatInstance.data.id
              })
            }
          >
            Change Configuration
          </Button>
        }
      >
        <Datalist
          items={[
            {
              label: 'Config',
              value: chatInstanceProvider.data?.config ? (
                <ID id={chatInstanceProvider.data.config.id} />
              ) : (
                <>-</>
              )
            },
            {
              label: 'Auth Config',
              value: chatInstanceProvider.data?.authConfig ? (
                <ID id={chatInstanceProvider.data.authConfig.id} />
              ) : (
                <>-</>
              )
            }
          ]}
        />
      </Box>

      <Spacer height={20} />

      <Box
        title="Chats"
        description="The chats this instance has synced from the chat provider."
      >
        {chats.data.items.length ? (
          <ChatsTable
            instanceId={instance.data!.id}
            chatInstanceId={chatInstance.data.id}
            listVariant="preview"
            listLimit={10}
          />
        ) : (
          <Text size="2" color="gray600">
            No chats have been synced for this instance yet.
          </Text>
        )}
      </Box>
    </DetailsOverviewLayout>
  ));
};
