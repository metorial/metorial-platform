import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnection,
  useChatInstance,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiChat3Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ChatInstanceLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatInstanceId } = useParams();
  let chatInstance = useChatInstance(instance.data?.id, chatInstanceId);
  let chatConnection = useChatConnection(
    instance.data?.id,
    chatInstance.data?.chatConnectionId
  );

  let instancePath = (...subPages: string[]) =>
    Paths.instance.chatInstance(
      organization.data,
      project.data,
      instance.data,
      chatInstance.data?.id ?? chatInstanceId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={chatInstance.data}
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
            chatInstance.data?.chatConnectionId
          )
        },
        {
          label: chatInstance.data?.name,
          to: instancePath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: instancePath() },
        { label: 'Events', to: instancePath('events') },
        { label: 'Settings', to: instancePath('settings') }
      ]}
      attributes={
        chatInstance.data
          ? [
              { label: 'ID', value: <ID id={chatInstance.data.id} /> },
              {
                label: 'Connection ID',
                value: <ID id={chatInstance.data.chatConnectionId} />
              },
              {
                label: 'Created',
                value: <RenderDate date={chatInstance.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ chatInstance })(({ chatInstance }) => (
          <>
            <DeletedRecordCallout status={chatInstance.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
