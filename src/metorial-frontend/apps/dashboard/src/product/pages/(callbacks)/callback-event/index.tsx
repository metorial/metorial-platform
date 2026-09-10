import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { JsonViewer } from '@metorial/json-viewer';
import {
  useCallbackEvent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CollapsibleBox } from '../../../scenes/sessionTracing/components/collapsibleBox';
import { SectionList } from '../../../scenes/providerInvocations/styled';
import {
  DashedLink,
  decodeWebhookBody,
  getCallbackEventStatusColor,
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';

export let CallbackEventPage = () => {
  let { callbackEventId } = useParams();

  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let event = useCallbackEvent(instance.data?.id, callbackEventId);

  return renderWithLoader({ event })(({ event }) => {
    let data = event.data;
    let isError = data.status === 'failed';
    let webhook = data.details?.webhook ?? null;
    let decodedBody = decodeWebhookBody(webhook?.request?.body);

    let items: { label: ReactNode; value: ReactNode }[] = [
      { label: 'Event ID', value: <ID id={data.id} /> },
      {
        label: 'Status',
        value: (
          <Badge size="1" color={getCallbackEventStatusColor(data.status)}>
            {data.status}
          </Badge>
        )
      },
      { label: 'Trigger', value: <>{data.providerTriggerKey}</> },
      { label: 'Source', value: <>{data.source}</> },
      {
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
      },
      { label: 'Callback Instance', value: <ID id={data.callbackInstanceId} /> },
      { label: 'Occurred', value: <RenderDate date={data.occurredAt} /> },
      { label: 'Recorded', value: <RenderDate date={data.createdAt} /> }
    ];

    if (data.mappedType) {
      items.push({
        label: 'Mapped Resource',
        value: (
          <>
            {data.mappedType}
            {data.mappedId ? ` · ${data.mappedId}` : ''}
          </>
        )
      });
    }

    return (
      <SectionList>
        {isError && data.details?.error ? (
          <Callout color="red">
            <span>
              <strong>{data.details.error.code}</strong> — {data.details.error.message}
            </span>
          </Callout>
        ) : null}

        <CollapsibleBox
          id="callback-event-details"
          title="Details"
          description={`${data.providerTriggerKey} event metadata.`}
          rightActions={
            <Badge size="1" color={getCallbackEventStatusColor(data.status)}>
              {data.status}
            </Badge>
          }
        >
          <Datalist items={items} />
        </CollapsibleBox>

        {data.details?.payload ? (
          <CollapsibleBox
            id="callback-event-payload"
            title="Payload"
            description="What the provider sent for this event."
          >
            <JsonViewer value={data.details.payload as any} />
          </CollapsibleBox>
        ) : null}

        {webhook ? (
          <CollapsibleBox
            id="callback-event-webhook"
            title="Inbound Webhook"
            description="The raw request this event was produced from."
            defaultCollapsed
            rightActions={
              <Badge size="1" color={getIncomingWebhookStatusColor(webhook.status)}>
                {getIncomingWebhookStatusLabel(webhook.status)}
              </Badge>
            }
          >
            <Datalist
              items={[
                { label: 'Received', value: <RenderDate date={webhook.receivedAt} /> },
                ...(webhook.request
                  ? [
                      { label: 'Method', value: <>{webhook.request.method}</> },
                      {
                        label: 'URL',
                        value: (
                          <Text size="1" style={{ wordBreak: 'break-all' }}>
                            {webhook.request.url}
                          </Text>
                        )
                      }
                    ]
                  : [])
              ]}
            />

            {webhook.request ? <JsonViewer value={webhook.request.headers as any} /> : null}

            {decodedBody ? (
              decodedBody.json !== null ? (
                <JsonViewer value={decodedBody.json as any} />
              ) : (
                <Text size="1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {decodedBody.text}
                </Text>
              )
            ) : null}
          </CollapsibleBox>
        ) : null}
      </SectionList>
    );
  });
};
