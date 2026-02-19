import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { SessionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { SessionConnectionStatusBadge } from '../../../scenes/sessions/table';

export let ProviderSessionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  let pathname = useLocation().pathname;

  let sessionPathParams = [
    organization.data,
    project.data,
    instance.data,
    session.data?.id ?? sessionId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={session.data?.name ?? `Session ${sessionId?.slice(0, 8)}...`}
        description={session.data?.description ?? undefined}
        pagination={[
          {
            label: 'Sessions',
            href: Paths.instance.providerSessions(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: session.data?.name ?? 'Session',
            href: Paths.instance.providerSession(
              organization.data,
              project.data,
              instance.data,
              session.data?.id ?? sessionId
            )
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Logs',
            to: Paths.instance.providerSession(...sessionPathParams)
          },
          {
            label: 'Overview',
            to: Paths.instance.providerSession(...sessionPathParams, 'overview')
          },
          {
            label: 'Deployments',
            to: Paths.instance.providerSession(...sessionPathParams, 'providers')
          },
          {
            label: 'Settings',
            to: Paths.instance.providerSession(...sessionPathParams, 'settings')
          }
        ]}
      />

      {renderWithLoader({ session })(({ session }) => (
        <AttributesLayout
          variant="large"
          items={[
            {
              label: 'Status',
              value: (
                <SessionConnectionStatusBadge
                  session={
                    session.data as unknown as Parameters<
                      typeof SessionConnectionStatusBadge
                    >[0]['session']
                  }
                />
              )
            },
            { label: 'Session ID', value: <ID id={session.data.id} /> },
            { label: 'Created At', value: <RenderDate date={session.data.createdAt} /> },
            {
              label: 'Messages',
              value: session.data.usage?.totalProductiveMessageCount ?? 0
            }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
