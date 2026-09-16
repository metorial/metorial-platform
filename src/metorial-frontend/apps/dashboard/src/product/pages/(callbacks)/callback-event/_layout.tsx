import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbackById,
  useCallbackEvent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, Outlet, useParams } from 'react-router-dom';
import { getCallbackEventStatusColor } from '../../../scenes/callbacks/shared';

export let CallbackEventLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { callbackEventId } = useParams();
  let event = useCallbackEvent(instance.data?.id, callbackEventId);
  let callback = useCallbackById(instance.data?.id, event.data?.callbackId);

  let eventPath = Paths.instance.callbackEvent(
    organization.data,
    project.data,
    instance.data,
    event.data?.id ?? callbackEventId
  );

  return (
    <DetailsLayout
      entity={event.data ? { ...event.data, name: event.data.providerTriggerKey } : event.data}
      breadcrumbs={[
        {
          label: 'Callbacks',
          to: Paths.instance.callbacks(organization.data, project.data, instance.data)
        },
        {
          label: callback.data?.name ?? 'Callback',
          to: Paths.instance.callback(
            organization.data,
            project.data,
            instance.data,
            event.data?.callbackId
          )
        },
        {
          label: event.data?.providerTriggerKey,
          to: eventPath
        }
      ]}
      attributes={
        event.data
          ? [
              { label: 'Event ID', value: <ID id={event.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge color={getCallbackEventStatusColor(event.data.status)}>
                    {event.data.status}
                  </Badge>
                )
              },
              { label: 'Source', value: event.data.source },
              {
                label: 'Callback',
                value: (
                  <Link
                    to={Paths.instance.callback(
                      organization.data,
                      project.data,
                      instance.data,
                      event.data.callbackId
                    )}
                  >
                    <ID id={event.data.callbackId} copy={false} />
                  </Link>
                )
              },
              {
                label: 'Callback Instance',
                value: <ID id={event.data.callbackInstanceId} />
              },
              ...(event.data.mappedType
                ? [
                    {
                      label: 'Mapped Resource',
                      value: `${event.data.mappedType}${
                        event.data.mappedId ? ` · ${event.data.mappedId}` : ''
                      }`
                    }
                  ]
                : []),
              { label: 'Occurred', value: <RenderDate date={event.data.occurredAt} /> },
              { label: 'Recorded', value: <RenderDate date={event.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ event })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
