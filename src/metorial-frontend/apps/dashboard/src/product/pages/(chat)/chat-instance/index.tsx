import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatInstance,
  useChatInstanceProvider,
  useChats,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Datalist, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  ChatInstanceConnectedAsSection,
  showChatInstanceProviderConfigPanelFlow
} from '../../../scenes/chat/instanceConfigPanel';

export let ChatInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
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
          <Table
            headers={['Name', 'Created', 'ID']}
            data={chats.data.items.map(chat => ({
              href: Paths.instance.chat(
                organization.data,
                project.data,
                instance.data,
                chat.id
              ),
              data: [
                <Text key="name" size="2" weight="strong">
                  {chat.name}
                </Text>,
                <RenderDate key="created" date={chat.createdAt} />,
                <ID key="id" id={chat.id} />
              ]
            }))}
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
