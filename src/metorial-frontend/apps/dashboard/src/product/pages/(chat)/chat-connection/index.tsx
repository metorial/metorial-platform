import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnection,
  useChatEvents,
  useChatInstances,
  useChats,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useProviderAuthMethod
} from '@metorial/state';
import { Button, Callout, Entity, Flex, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { EventDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import { CallbackWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';
import { ChatsTable } from '../../../scenes/chat/chatsTable';
import { ChatInvocationFailuresTable } from '../../../scenes/chat/eventsTable';
import { ChatInstancesTable } from '../../../scenes/chat/instancesTable';
import { showChatInstanceCreateProviderPanelFlow } from '../../../scenes/chat/instanceConfigPanel';
import { ChatProviderAvatar, useChatProviderListings } from '../../../scenes/chat/shared';

export let ChatConnectionOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { chatConnectionId } = useParams();
  let failedInvocationWindowStart = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    []
  );
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);
  let failedInvocationEvents = useChatEvents(instance.data?.id, {
    chatConnectionId,
    type: 'chat.invocation.failed',
    occurredAt: { gt: failedInvocationWindowStart },
    limit: 5,
    order: 'desc'
  });
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

  return renderWithLoader({ chatConnection, failedInvocationEvents, chatInstances, chats })(
    ({ chatConnection, failedInvocationEvents, chatInstances, chats }) => {
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
      let failedEventsPath = `${Paths.instance.chatConnection(
        organization.data,
        project.data,
        instance.data,
        chatConnection.data.id,
        'events'
      )}?type=chat.invocation.failed`;

      return (
        <DetailsOverviewLayout>
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

          {failedInvocationEvents.data.items.length ? (
            <>
              <Box
                title="Recent Invocation Failures"
                description="Failed chat invocations recorded during the last 7 days."
              >
                <Callout color="red">
                  Some chat invocations failed during the last 7 days. Review the events below
                  for details.
                </Callout>
                <Spacer height={12} />
                <ChatInvocationFailuresTable
                  instanceId={instance.data!.id}
                  chatConnectionId={chatConnection.data.id}
                  viewAllHref={failedEventsPath}
                />
              </Box>
              <Spacer height={20} />
            </>
          ) : null}

          {provider ? (
            <CallbackWebhookRegistrationsBox
              instanceId={instance.data!.id}
              providerId={provider.provider.id}
              authCredentialsId={provider.authCredentialsId}
              authCredentialsIsManaged={provider.authCredentialsIsManaged}
            />
          ) : null}

          {flags.data?.flags['webhooks-enabled'] ? (
            <>
              <EventDeliveryBox
                organizationId={organization.data!.id}
                instanceId={instance.data!.id}
                target={{ type: 'chat', chatConnectionId: chatConnection.data.id }}
                description="Event destinations subscribed to this chat connection's events."
              />
              <Spacer height={20} />
            </>
          ) : null}

          <Box
            title="Recent Instances"
            description="Chat accounts configured for this connection."
          >
            {chatInstances.data.items.length ? (
              <ChatInstancesTable
                instanceId={instance.data!.id}
                chatConnectionId={chatConnection.data.id}
                listVariant="preview"
                listLimit={10}
                viewAllHref={instancesPath}
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
          >
            {chats.data.items.length ? (
              <ChatsTable
                instanceId={instance.data!.id}
                chatConnectionId={chatConnection.data.id}
                listVariant="preview"
                listLimit={10}
                viewAllHref={chatsPath}
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
