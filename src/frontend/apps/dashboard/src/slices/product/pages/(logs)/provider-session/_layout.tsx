import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

let OutletWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

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
    <ContentPanelLayout
      title={session.data?.name ?? `Session ${sessionId?.slice(0, 8)}...`}
      breadcrumbs={[
        {
          label: 'Sessions',
          to: Paths.instance.providerSessions(organization.data, project.data, instance.data)
        },
        {
          label: session.data?.name ?? 'Session',
          to: Paths.instance.providerSession(
            organization.data,
            project.data,
            instance.data,
            session.data?.id ?? sessionId
          )
        }
      ]}
      description={session.data?.description ?? undefined}
      extra={<DeletedRecordCallout status={session.data?.status} />}
      links={{
        current: pathname,
        items: [
          {
            label: 'Logs',
            to: Paths.instance.providerSession(...sessionPathParams)
          },
          {
            label: 'Deployments',
            to: Paths.instance.providerSession(...sessionPathParams, 'providers')
          },
          {
            label: 'Provider Runs',
            to: Paths.instance.providerSession(...sessionPathParams, 'runs')
          }
        ]
      }}
    >
      {renderWithLoader({ session })(({ session }) => (
        <OutletWrapper>
          <Outlet />
        </OutletWrapper>
      ))}
    </ContentPanelLayout>
  );
};
