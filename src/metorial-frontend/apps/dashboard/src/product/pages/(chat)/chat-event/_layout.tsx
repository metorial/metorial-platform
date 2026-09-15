import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChat,
  useChatConnection,
  useChatEvent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, Outlet, useParams } from 'react-router-dom';

export let ChatEventLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatEventId } = useParams();
  let chatEvent = useChatEvent(instance.data?.id, chatEventId);
  let chat = useChat(instance.data?.id, chatEvent.data?.chatId);
  let connection = useChatConnection(instance.data?.id, chat.data?.chatConnectionId);

  return (
    <DetailsLayout
      entity={
        chatEvent.data ? { ...chatEvent.data, name: chatEvent.data.type } : chatEvent.data
      }
      breadcrumbs={[
        {
          label: 'Chat',
          to: Paths.instance.chatConnections(organization.data, project.data, instance.data)
        },
        {
          label: connection.data?.name ?? 'Connection',
          to: Paths.instance.chatConnection(
            organization.data,
            project.data,
            instance.data,
            connection.data?.id
          )
        },
        {
          label: chat.data?.name ?? 'Chat',
          to: Paths.instance.chat(
            organization.data,
            project.data,
            instance.data,
            chatEvent.data?.chatId
          )
        },
        {
          label: chatEvent.data?.type,
          to: Paths.instance.chatEvent(
            organization.data,
            project.data,
            instance.data,
            chatEvent.data?.id ?? chatEventId
          )
        }
      ]}
      attributes={
        chatEvent.data
          ? [
              { label: 'Event ID', value: <ID id={chatEvent.data.id} /> },
              { label: 'Type', value: chatEvent.data.type },
              {
                label: 'Source',
                value: (
                  <Badge color={chatEvent.data.source == 'webhook' ? 'blue' : 'gray'}>
                    {chatEvent.data.source}
                  </Badge>
                )
              },
              {
                label: 'Chat',
                value: (
                  <Link
                    to={Paths.instance.chat(
                      organization.data,
                      project.data,
                      instance.data,
                      chatEvent.data.chatId
                    )}
                  >
                    <ID id={chatEvent.data.chatId} copy={false} />
                  </Link>
                )
              },
              {
                label: 'Channel',
                value: chatEvent.data.channelId ? <ID id={chatEvent.data.channelId} /> : '-'
              },
              {
                label: 'Message',
                value: chatEvent.data.messageId ? <ID id={chatEvent.data.messageId} /> : '-'
              },
              {
                label: 'Author',
                value: chatEvent.data.authorId ? <ID id={chatEvent.data.authorId} /> : '-'
              },
              {
                label: 'Occurred',
                value: <RenderDate date={chatEvent.data.occurredAt} />
              },
              {
                label: 'Recorded',
                value: <RenderDate date={chatEvent.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ chatEvent })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
