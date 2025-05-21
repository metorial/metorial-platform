import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { SessionConnectionStatusBadge } from '../../../scenes/sessions/table';

export let SessionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    session.data?.id ?? sessionId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Server Run"
        pagination={[
          {
            label: 'Runs',
            href: Paths.instance.sessions(organization.data, project.data, instance.data)
          },
          {
            label: session.data?.id,
            href: Paths.instance.session(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Logs',
            to: Paths.instance.session(...serverPathParams)
          },
          {
            label: 'Deployments',
            to: Paths.instance.session(...serverPathParams, 'deployments')
          },
          {
            label: 'Server Runs',
            to: Paths.instance.session(...serverPathParams, 'runs')
          }
        ]}
      />

      {renderWithLoader({ session })(({ session }) => (
        <AttributesLayout
          items={[
            {
              label: 'Status',
              value: <SessionConnectionStatusBadge session={session.data} />
            },
            { label: 'Session ID', value: <ID id={session.data.id} /> },
            { label: 'Created At', value: <RenderDate date={session.data.createdAt} /> },
            {
              label: 'Client Messages',
              value: session.data.usage.totalProductiveClientMessageCount
            },
            {
              label: 'Server Messages',
              value: session.data.usage.totalProductiveServerMessageCount
            }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
