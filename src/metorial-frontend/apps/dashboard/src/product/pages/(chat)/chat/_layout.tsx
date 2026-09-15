import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChat,
  useChatConnection,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { RiChat3Line } from '@remixicon/react';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ChatLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatId } = useParams();
  let chat = useChat(instance.data?.id, chatId);
  let chatConnection = useChatConnection(instance.data?.id, chat.data?.chatConnectionId);

  let chatPath = (...subPages: string[]) =>
    Paths.instance.chat(
      organization.data,
      project.data,
      instance.data,
      chat.data?.id ?? chatId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={chat.data}
      icon={<RiChat3Line />}
      breadcrumbs={[
        {
          label: 'Chat',
          to: Paths.instance.chatConnections(organization.data, project.data, instance.data)
        },
        {
          label: chatConnection.data?.name ?? 'Connection',
          to: Paths.instance.chatConnection(
            organization.data,
            project.data,
            instance.data,
            chat.data?.chatConnectionId
          )
        },
        {
          label: chat.data?.name,
          to: chatPath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: chatPath() },
        { label: 'Events', to: chatPath('events') }
      ]}
      attributes={
        chat.data
          ? [
              { label: 'ID', value: <ID id={chat.data.id} /> },
              {
                label: 'Workspace',
                value: chat.data.workspaceId ? <ID id={chat.data.workspaceId} /> : '-'
              },
              {
                label: 'Created',
                value: <RenderDate date={chat.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ chat })(({ chat }) => (
          <>
            <DeletedRecordCallout status={chat.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
