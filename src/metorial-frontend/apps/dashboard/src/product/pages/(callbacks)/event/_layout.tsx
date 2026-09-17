import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEvent
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, Outlet, useParams } from 'react-router-dom';

export let EventLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { eventId } = useParams();
  let event = useEvent(organization.data?.id, eventId);

  return (
    <DetailsLayout
      entity={event.data ? { ...event.data, name: event.data.eventType } : event.data}
      breadcrumbs={[
        {
          label: 'Webhooks',
          to: Paths.instance.eventDestinations(organization.data, project.data, instance.data)
        },
        {
          label: event.data?.eventType ?? 'Event',
          to: Paths.instance.event(
            organization.data,
            project.data,
            instance.data,
            event.data?.id ?? eventId
          )
        }
      ]}
      attributes={
        event.data
          ? [
              { label: 'Event ID', value: <ID id={event.data.id} /> },
              { label: 'Type', value: event.data.eventType },
              {
                label: 'Source',
                value: (
                  <Badge
                    color={
                      event.data.source === 'callback' || event.data.source === 'chat'
                        ? 'blue'
                        : 'gray'
                    }
                  >
                    {event.data.source.charAt(0).toUpperCase() + event.data.source.slice(1)}
                  </Badge>
                )
              },
              ...(event.data.callbackId
                ? [
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
                    }
                  ]
                : []),
              ...(event.data.chatEventId
                ? [
                    {
                      label: 'Chat Event',
                      value: (
                        <Link
                          to={Paths.instance.chatEvent(
                            organization.data,
                            project.data,
                            instance.data,
                            event.data.chatEventId
                          )}
                        >
                          <ID id={event.data.chatEventId} copy={false} />
                        </Link>
                      )
                    }
                  ]
                : []),
              ...(event.data.chatConnectionId
                ? [
                    {
                      label: 'Chat Connection',
                      value: (
                        <Link
                          to={Paths.instance.chatConnection(
                            organization.data,
                            project.data,
                            instance.data,
                            event.data.chatConnectionId
                          )}
                        >
                          <ID id={event.data.chatConnectionId} copy={false} />
                        </Link>
                      )
                    }
                  ]
                : []),

              ...(event.data.callbackTriggerKey
                ? [{ label: 'Trigger', value: event.data.callbackTriggerKey }]
                : []),
              {
                label: 'Instance',
                value: event.data.instanceId ? <ID id={event.data.instanceId} /> : '-'
              },
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
