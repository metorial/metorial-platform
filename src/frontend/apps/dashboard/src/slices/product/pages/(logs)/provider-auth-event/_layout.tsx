import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  ContentPanelLayout,
  ContentPanelLayoutInner,
  ExtraHeaderLayout
} from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigEvent
} from '@metorial/state';
import { Button, theme } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

let ExtraRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  align-items: center;
  margin-top: 4px;
  font-size: 13px;
  color: ${theme.colors.gray600};
`;

let ExtraItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

let ExtraLabel = styled.span`
  font-weight: 600;
  color: ${theme.colors.gray600};
`;

let getEventBadgeColor = (type: string): 'red' | 'green' | 'blue' | 'orange' | 'gray' => {
  if (type.endsWith('_failed') || type.includes('error')) return 'red';
  if (type.endsWith('_succeeded') || type.endsWith('_completed')) return 'green';
  if (type.includes('refresh') || type.includes('token')) return 'orange';
  if (type.includes('started') || type.includes('opened')) return 'blue';
  return 'gray';
};

export let ProviderAuthEventLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthEventId } = useParams();
  let event = useProviderAuthConfigEvent(instance.data?.id, providerAuthEventId);

  let pathname = useLocation().pathname;

  let authEventParams = [
    organization.data,
    project.data,
    instance.data,
    event.data?.id ?? providerAuthEventId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link
          to={Paths.instance.providerAuthEvents(
            organization.data,
            project.data,
            instance.data
          )}
        >
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all auth events
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={event.data?.type ?? `Auth event ${providerAuthEventId?.slice(0, 8)}...`}
        breadcrumbs={[
          {
            label: 'Auth Events',
            to: Paths.instance.providerAuthEvents(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: event.data?.type ?? 'Auth Event',
            to: Paths.instance.providerAuthEvent(...authEventParams)
          }
        ]}
        links={{
          current: pathname,
          items: [
            {
              label: 'Details',
              to: Paths.instance.providerAuthEvent(...authEventParams)
            }
          ]
        }}
      >
        <ContentPanelLayoutInner>
          {renderWithLoader({ event })(({ event: _event }) => (
            <Outlet />
          ))}
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
