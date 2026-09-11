import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
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
  useEvent
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

export let EventLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { eventId } = useParams();
  let event = useEvent(organization.data?.id, eventId);

  let pathname = useLocation().pathname;
  let listPath = Paths.instance.events(organization.data, project.data, instance.data);
  let params = [
    organization.data,
    project.data,
    instance.data,
    event.data?.id ?? eventId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={listPath}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all events
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={event.data?.eventType ?? `Event ${eventId?.slice(0, 8)}...`}
        breadcrumbs={[
          { label: 'Events', to: listPath },
          {
            label: event.data?.eventType ?? 'Event',
            to: Paths.instance.event(...params)
          }
        ]}
        links={{
          current: pathname,
          items: [{ label: 'Details', to: Paths.instance.event(...params) }]
        }}
      >
        <ContentPanelLayoutInner>
          <InitialLoadBoundary>
            {renderWithLoader({ event })(() => (
              <Outlet />
            ))}
          </InitialLoadBoundary>
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
