import { renderWithPagination } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnections,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { showCreateChatConnectionFlow } from './connectionPanelFlow';
import { ChatProviderAvatar, useChatProviderListings } from './shared';

export let ChatConnectionsGrid = (p: { instanceId: string; search?: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let chatConnections = useChatConnections(p.instanceId, {
    order: 'desc',
    status: ['active'],
    search: p.search
  });
  let providerIds = useMemo(
    () =>
      (chatConnections.data?.items ?? []).flatMap(chatConnection =>
        chatConnection.providers.map(provider => provider.provider.id)
      ),
    [chatConnections.data?.items]
  );
  let providerListings = useChatProviderListings(p.instanceId, providerIds);

  let createConnection = () =>
    showCreateChatConnectionFlow({
      onCreate: chatConnection =>
        navigate(
          Paths.instance.chatConnection(
            organization.data,
            project.data,
            instance.data,
            chatConnection.id
          )
        )
    });

  return renderWithPagination(chatConnections)(chatConnections => (
    <>
      {chatConnections.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {chatConnections.data.items.map(chatConnection => {
            let provider = chatConnection.providers[0];

            return (
              <ItemGrid.Item
                key={chatConnection.id}
                href={Paths.instance.chatConnection(
                  organization.data,
                  project.data,
                  instance.data,
                  chatConnection.id
                )}
                entity={{ id: chatConnection.id }}
                title={chatConnection.name}
                description={chatConnection.description}
                variant="v2"
                height={200}
                icon={
                  <ChatProviderAvatar
                    provider={provider?.provider}
                    listings={providerListings.lookup}
                  />
                }
                bottom={
                  chatConnection.slug ? <Text size="1">{chatConnection.slug}</Text> : undefined
                }
              />
            );
          })}
        </ItemGrid.Root>
      )}

      {chatConnections.data.items.length === 0 && p.search && (
        <Text size="2" color="gray600">
          No chat connections found.
        </Text>
      )}

      {chatConnections.data.items.length === 0 && !p.search && (
        <EmptyState
          extra="Chat"
          title="Connect your first chat provider"
          description="Connect Metorial to chat providers like Slack, then connect agents to send and receive messages."
          action={{
            label: 'Create Chat Connection',
            onClick: createConnection
          }}
        />
      )}
    </>
  ));
};
