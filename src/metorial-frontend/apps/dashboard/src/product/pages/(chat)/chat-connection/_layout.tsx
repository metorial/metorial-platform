import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnection,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { RiChat3Line } from '@remixicon/react';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useParams } from 'react-router-dom';
import { showChatInstanceCreateProviderPanelFlow } from '../../../scenes/chat/instanceConfigPanel';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ChatConnectionLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);

  let connectionPath = (...subPages: string[]) =>
    Paths.instance.chatConnection(
      organization.data,
      project.data,
      instance.data,
      chatConnection.data?.id ?? chatConnectionId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={chatConnection.data}
      icon={<RiChat3Line />}
      breadcrumbs={[
        {
          label: 'Chat',
          to: Paths.instance.chatConnections(organization.data, project.data, instance.data)
        },
        {
          label: chatConnection.data?.name,
          to: connectionPath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: connectionPath() },
        { label: 'Instances', to: connectionPath('instances') },
        { label: 'Chats', to: connectionPath('chats') },
        { label: 'Events', to: connectionPath('events') },
        { label: 'Settings', to: connectionPath('settings') }
      ]}
      actions={[
        {
          label: 'Create Instance',
          disabled: !instance.data || !chatConnection.data,
          onClick: () => {
            if (!instance.data || !chatConnection.data) return;

            showChatInstanceCreateProviderPanelFlow({
              instanceId: instance.data.id,
              chatConnectionId: chatConnection.data.id
            });
          }
        }
      ]}
      attributes={
        chatConnection.data
          ? [
              { label: 'ID', value: <ID id={chatConnection.data.id} /> },
              { label: 'Slug', value: <ID id={chatConnection.data.slug} /> },
              {
                label: 'Provider',
                value: chatConnection.data.providers[0]?.name ?? '-'
              },
              {
                label: 'Created',
                value: <RenderDate date={chatConnection.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ chatConnection })(({ chatConnection }) => (
          <>
            <DeletedRecordCallout status={chatConnection.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
