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
import { Button, Callout, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EventDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import { ProviderWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';
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
                rightActions={
                  <Link to={failedEventsPath}>
                    <Button size="2" as="span" variant="outline">
                      View All Events
                    </Button>
                  </Link>
                }
              >
                <Callout color="red">
                  Some chat invocations failed during the last 7 days. Review the events below
                  for details.
                </Callout>
                <Spacer height={12} />
                <Table
                  headers={['Operation', 'Error', 'Occurred']}
                  data={failedInvocationEvents.data.items.map(event => ({
                    href: Paths.instance.chatEvent(
                      organization.data,
                      project.data,
                      instance.data,
                      event.id
                    ),
                    data: [
                      <Text key="operation" size="2" weight="strong">
                        {event.error?.operation ?? '-'}
                      </Text>,
                      <Text key="error" size="2">
                        {event.error?.message ?? event.error?.code ?? '-'}
                      </Text>,
                      <RenderDate key="occurred" date={event.occurredAt} />
                    ]
                  }))}
                />
              </Box>
              <Spacer height={20} />
            </>
          ) : null}

          {provider?.manualWebhookTriggerGroups.length &&
          !provider.authCredentialsIsManaged ? (
            <ProviderWebhookRegistrationsBox
              instanceId={instance.data!.id}
              provider={{ id: provider.provider.id, name: provider.provider.name }}
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
