import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { JsonViewer } from '@metorial/json-viewer';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEvent
} from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { DashedLink } from '../../../scenes/callbacks/shared';
import { SectionList } from '../../../scenes/providerInvocations/styled';
import { CollapsibleBox } from '../../../scenes/sessionTracing/components/collapsibleBox';

export let EventPage = () => {
  let { eventId } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let event = useEvent(organization.data?.id, eventId);

  return renderWithLoader({ event })(({ event }) => {
    let data = event.data;
    let isCallback = data.source === 'callback';

    let items: { label: ReactNode; value: ReactNode }[] = [
      { label: 'Event ID', value: <ID id={data.id} /> },
      { label: 'Event Type', value: <>{data.eventType}</> },
      {
        label: 'Source',
        value: (
          <Badge size="1" color={isCallback ? 'blue' : 'gray'}>
            {isCallback ? 'Callback' : 'Resource'}
          </Badge>
        )
      },
      {
        label: 'Instance',
        value: data.instanceId ? (
          <ID id={data.instanceId} />
        ) : (
          <Text size="2" color="gray600">
            Organization-level event
          </Text>
        )
      },
      { label: 'Recorded', value: <RenderDate date={data.createdAt} /> }
    ];

    if (data.callbackId) {
      items.splice(3, 0, {
        label: 'Callback',
        value: (
          <DashedLink
            to={Paths.instance.callback(
              organization.data,
              project.data,
              instance.data,
              data.callbackId
            )}
          >
            <ID id={data.callbackId} copy={false} />
          </DashedLink>
        )
      });
    }

    if (data.callbackTriggerKey) {
      items.splice(4, 0, {
        label: 'Trigger',
        value: <>{data.callbackTriggerKey}</>
      });
    }

    return (
      <SectionList>
        <CollapsibleBox
          id="event-details"
          title="Details"
          description="Everything Metorial recorded about this event."
          rightActions={
            <Badge size="1" color={isCallback ? 'blue' : 'gray'}>
              {isCallback ? 'Callback' : 'Resource'}
            </Badge>
          }
        >
          <Datalist items={items} />
        </CollapsibleBox>

        <CollapsibleBox
          id="event-payload"
          title="Payload"
          description="The body delivered to every event destination subscribed to this event."
        >
          {data.payload ? (
            <JsonViewer value={data.payload as any} />
          ) : (
            <Callout color="gray">
              <span>
                Callback events carry no payload of their own — open the linked callback event
                to see what the provider sent.
              </span>
            </Callout>
          )}
        </CollapsibleBox>
      </SectionList>
    );
  });
};
