import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnection,
  useChatInstances,
  useChats,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthMethod
} from '@metorial/state';
import { Button, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { showChatInstanceCreateProviderPanelFlow } from '../../../scenes/chat/instanceConfigPanel';
import { ChatProviderAvatar, useChatProviderListings } from '../../../scenes/chat/shared';
import { ProviderWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';

export let ChatConnectionOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);
  let chatInstances = useChatInstances(instance.data?.id, {
    chatConnectionId,
    limit: 10,
    order: 'desc',
    status: ['draft', 'active']
  });
  let chats = useChats(instance.data?.id, {
    chatConnectionId,
    limit: 10,
    order: 'desc',
    status: ['active']
  });
  let providerListings = useChatProviderListings(
    instance.data?.id,
    (chatConnection.data?.providers ?? []).map(provider => provider.provider.id)
  );
  let provider = chatConnection.data?.providers[0];
  let authMethod = useProviderAuthMethod(instance.data?.id, provider?.authMethodId);

  return renderWithLoader({ chatConnection, chatInstances, chats })(
    ({ chatConnection, chatInstances, chats }) => {
      let instancesPath = Paths.instance.chatConnection(
        organization.data,
        project.data,
        instance.data,
        chatConnection.data.id,
        'instances'
      );
      let chatsPath = Paths.instance.chatConnection(
        organization.data,
        project.data,
        instance.data,
        chatConnection.data.id,
        'chats'
      );

      return (
        <DetailsOverviewLayout>
          {provider?.manualWebhookTriggerGroups.length &&
          !provider.authCredentialsIsManaged ? (
            <ProviderWebhookRegistrationsBox
              instanceId={instance.data!.id}
              provider={{ id: provider.provider.id, name: provider.provider.name }}
            />
          ) : null}

          <Entity.Wrapper header="Provider">
            {provider ? (
              <Entity.Content>
                <Entity.Field
                  title={
                    providerListings.lookup.get(provider.provider.id)?.name ??
                    provider.provider.name
                  }
                  prefix={
                    <ChatProviderAvatar
                      provider={provider.provider}
                      listings={providerListings.lookup}
                    />
                  }
                />
                <Entity.Field title="Auth Method" value={authMethod.data?.name ?? '-'} />
              </Entity.Content>
            ) : (
              <Entity.ContentRaw>
                <Text size="2" color="gray600">
                  This connection has no provider attached.
                </Text>
              </Entity.ContentRaw>
            )}
          </Entity.Wrapper>

          <Spacer height={20} />

          <Box
            title="Recent Instances"
            description="Chat accounts configured for this connection."
            rightActions={
              chatInstances.data.items.length ? (
                <Link to={instancesPath}>
                  <Button size="2" as="span" variant="outline">
                    View All Instances
                  </Button>
                </Link>
              ) : undefined
            }
          >
            {chatInstances.data.items.length ? (
              <Table
                headers={['Name', 'Created', 'ID']}
                data={chatInstances.data.items.slice(0, 10).map(chatInstance => ({
                  href: Paths.instance.chatInstance(
                    organization.data,
                    project.data,
                    instance.data,
                    chatInstance.id
                  ),
                  data: [
                    <Text key="name" size="2" weight="strong">
                      {chatInstance.name}
                    </Text>,
                    <RenderDate key="created" date={chatInstance.createdAt} />,
                    <ID key="id" id={chatInstance.id} />
                  ]
                }))}
              />
            ) : (
              <Flex align="center" justify="space-between" gap={12}>
                <Text size="2" color="gray600">
                  Configure authentication for the first chat account connected here.
                </Text>
                <Button
                  size="2"
                  onClick={() =>
                    showChatInstanceCreateProviderPanelFlow({
                      instanceId: instance.data!.id,
                      chatConnectionId: chatConnection.data.id
                    })
                  }
                >
                  Configure Auth
                </Button>
              </Flex>
            )}
          </Box>

          <Spacer height={20} />

          <Box
            title="Recent Chats"
            description="The latest chats connected through this connection."
            rightActions={
              chats.data.items.length ? (
                <Link to={chatsPath}>
                  <Button size="2" as="span" variant="outline">
                    View All Chats
                  </Button>
                </Link>
              ) : undefined
            }
          >
            {chats.data.items.length ? (
              <Table
                headers={['Name', 'Created', 'ID']}
                data={chats.data.items.slice(0, 10).map(chat => ({
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
                No chats have been synced through this connection yet.
              </Text>
            )}
          </Box>
        </DetailsOverviewLayout>
      );
    }
  );
};
