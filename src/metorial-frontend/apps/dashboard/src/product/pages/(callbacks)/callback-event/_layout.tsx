import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  ContentPanelLayout,
  ContentPanelLayoutInner,
  ExtraHeaderLayout
} from '@metorial/layout';
import {
  useCallbackEvent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

export let CallbackEventLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { callbackEventId } = useParams();
  let event = useCallbackEvent(instance.data?.id, callbackEventId);

  let pathname = useLocation().pathname;
  let listPath = Paths.instance.callbackEvents(organization.data, project.data, instance.data);
  let params = [
    organization.data,
    project.data,
    instance.data,
    event.data?.id ?? callbackEventId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={listPath}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all callback events
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={
          event.data?.providerTriggerKey ?? `Callback event ${callbackEventId?.slice(0, 8)}...`
        }
        breadcrumbs={[
          { label: 'Callback Events', to: listPath },
          {
            label: event.data?.providerTriggerKey ?? 'Callback Event',
            to: Paths.instance.callbackEvent(...params)
          }
        ]}
        links={{
          current: pathname,
          items: [{ label: 'Details', to: Paths.instance.callbackEvent(...params) }]
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
