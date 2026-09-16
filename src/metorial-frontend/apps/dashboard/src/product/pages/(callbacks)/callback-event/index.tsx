import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useCallbackEvent, useCurrentInstance } from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  decodeWebhookBody,
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';
import { SectionList } from '../../../scenes/providerInvocations/styled';

export let CallbackEventPage = () => {
  let { callbackEventId } = useParams();

  let instance = useCurrentInstance();

  let event = useCallbackEvent(instance.data?.id, callbackEventId);

  return renderWithLoader({ event })(({ event }) => {
    let data = event.data;
    let isError = data.status === 'failed';
    let webhook = data.details?.webhook ?? null;
    let decodedBody = decodeWebhookBody(webhook?.request?.body);
    let payload = data.details?.payload ? JSON.stringify(data.details.payload, null, 2) : null;
    let headers = webhook?.request ? Object.entries(webhook.request.headers) : [];

    return (
      <DetailsOverviewLayout>
        <SectionList>
          {isError && data.details?.error ? (
            <Callout color="red">
              <span>
                <strong>{data.details.error.code}</strong> — {data.details.error.message}
              </span>
            </Callout>
          ) : null}

          <Box title="Payload" noPadding={!!payload}>
            {payload ? (
              <CodeBlock code={payload} language="json" variant="seamless" padding="15px" />
            ) : (
              <Text size="2" color="gray600">
                This event has no payload.
              </Text>
            )}
          </Box>

          {webhook ? (
            <Box
              title="Webhook Request"
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
                          value: <>{webhook.request.url}</>
                        }
                      ]
                    : [])
                ]}
              />
            </Box>
          ) : null}

          {webhook?.request ? (
            <Box title="Webhook Headers">
              {headers.length ? (
                <Datalist
                  items={headers.map(([name, value]) => ({
                    label: name,
                    value: Array.isArray(value) ? value.join(', ') : String(value)
                  }))}
                />
              ) : (
                <Text size="2" color="gray600">
                  This request did not include headers.
                </Text>
              )}
            </Box>
          ) : null}

          {webhook?.request ? (
            <Box title="Webhook Body" noPadding={!!decodedBody}>
              {decodedBody ? (
                <CodeBlock
                  code={
                    decodedBody.json !== null ? String(decodedBody.json) : decodedBody.text
                  }
                  language={decodedBody.json !== null ? 'json' : 'text'}
                  variant="seamless"
                  padding="15px"
                />
              ) : (
                <Text size="2" color="gray600">
                  This request did not include a body.
                </Text>
              )}
            </Box>
          ) : null}
        </SectionList>
      </DetailsOverviewLayout>
    );
  });
};
