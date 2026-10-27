import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ResourceOwnerInline } from '../../../components/resourceOwnerEntity';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

let HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > a {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  > a:first-child {
    flex-shrink: 0;
  }
`;

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
    <ExtraHeaderLayout
      header={
        <HeaderRow>
          <Link
            to={Paths.instance.providerSessions(
              organization.data,
              project.data,
              instance.data
            )}
          >
            <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
              Back to all sessions
            </Button>
          </Link>

          {session.data?.access.owner && <ResourceOwnerInline resource={session.data} />}
        </HeaderRow>
      }
    >
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
            }
          ]
        }}
      >
        <InitialLoadBoundary>
          {renderWithLoader(
            { session },
            { spaceTop: 20 }
          )(({ session }) => (
            <OutletWrapper>
              <Outlet />
            </OutletWrapper>
          ))}
        </InitialLoadBoundary>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
