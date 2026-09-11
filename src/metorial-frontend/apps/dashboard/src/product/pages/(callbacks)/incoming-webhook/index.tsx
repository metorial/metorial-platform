import { renderWithLoader } from '@metorial/data-hooks';
import { JsonViewer } from '@metorial/json-viewer';
import { useCurrentInstance, useIncomingWebhook } from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { SectionList } from '../../../scenes/providerInvocations/styled';
import { CollapsibleBox } from '../../../scenes/sessionTracing/components/collapsibleBox';
import {
  decodeWebhookBody,
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';

export let IncomingWebhookPage = () => {
  let { incomingWebhookId } = useParams();
  let instance = useCurrentInstance();
  let webhook = useIncomingWebhook(instance.data?.id, incomingWebhookId);

  return renderWithLoader({ webhook })(({ webhook }) => {
    let data = webhook.data;
    let isError = data.status === 'failed_final' || data.status === 'failed_retrying';
    let decodedBody = decodeWebhookBody(data.details?.body);

    return (
      <SectionList>
        {isError ? (
          <Callout color="red">
            <span>
              <strong>Metorial could not process this webhook.</strong>{' '}
              {data.status === 'failed_retrying'
                ? 'It is still being retried.'
                : 'All retries were exhausted, so no callback event was produced.'}
            </span>
          </Callout>
        ) : null}

        <CollapsibleBox
          id="incoming-webhook-details"
          title="Details"
          description="What Metorial received and how far processing got."
          rightActions={
            <Badge size="1" color={getIncomingWebhookStatusColor(data.status)}>
              {getIncomingWebhookStatusLabel(data.status)}
            </Badge>
          }
        >
          <Datalist
            items={[
              { label: 'Webhook ID', value: <ID id={data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge size="1" color={getIncomingWebhookStatusColor(data.status)}>
                    {getIncomingWebhookStatusLabel(data.status)}
                  </Badge>
                )
              },
              { label: 'Attempts', value: <>{data.attemptCount}</> },
              { label: 'Provider', value: <ID id={data.providerId} /> },
              {
                label: 'Webhook Receiver',
                value: data.webhookRegistrationId ? (
                  <ID id={data.webhookRegistrationId} />
                ) : (
                  <Text size="2" color="gray600">
                    Not matched to a receiver
                  </Text>
                )
              },
              { label: 'Received', value: <RenderDate date={data.receivedAt} /> }
            ]}
          />
        </CollapsibleBox>

        {data.details ? (
          <CollapsibleBox
            id="incoming-webhook-request"
            title="Request"
            description="The raw inbound HTTP request."
          >
            <Datalist
              items={[
                { label: 'Method', value: <>{data.details.method}</> },
                {
                  label: 'URL',
                  value: (
                    <Text size="1" style={{ wordBreak: 'break-all' }}>
                      {data.details.url}
                    </Text>
                  )
                }
              ]}
            />

            <JsonViewer value={data.details.headers as any} />

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
