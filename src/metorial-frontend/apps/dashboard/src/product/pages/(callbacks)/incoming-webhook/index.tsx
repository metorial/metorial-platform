import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { JsonViewer } from '@metorial/json-viewer';
import { useCurrentInstance, useIncomingWebhook } from '@metorial/state';
import { Callout, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { decodeWebhookBody } from '../../../scenes/callbacks/shared';

export let IncomingWebhookPage = () => {
  let { incomingWebhookId } = useParams();
  let instance = useCurrentInstance();
  let webhook = useIncomingWebhook(instance.data?.id, incomingWebhookId);

  return renderWithLoader({ webhook })(({ webhook }) => {
    let data = webhook.data;
    let isError = data.status === 'failed_final' || data.status === 'failed_retrying';
    let decodedBody = decodeWebhookBody(data.details?.body);

    return (
      <DetailsOverviewLayout>
        {isError ? (
          <>
            <Callout color="red">
              <span>
                <strong>Metorial could not process this webhook.</strong>{' '}
                {data.status === 'failed_retrying'
                  ? 'It is still being retried.'
                  : 'All retries were exhausted, so no callback event was produced.'}
              </span>
            </Callout>
            <Spacer height={20} />
          </>
        ) : null}

        <Box title="Request" description="The raw inbound HTTP request.">
          {data.details ? (
            <>
              <Text size="2">
                {data.details.method} {data.details.url}
              </Text>

              <Spacer height={16} />

              <JsonViewer value={data.details.headers as any} />

              {decodedBody ? (
                <>
                  <Spacer height={16} />
                  {decodedBody.json !== null ? (
                    <JsonViewer value={decodedBody.json as any} />
                  ) : (
                    <Text size="1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {decodedBody.text}
                    </Text>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <Text size="2" color="gray600">
              This event has no request payload.
            </Text>
          )}
        </Box>
      </DetailsOverviewLayout>
    );
  });
};
