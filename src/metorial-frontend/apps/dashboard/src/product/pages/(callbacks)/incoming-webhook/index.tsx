import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useCurrentInstance, useIncomingWebhook } from '@metorial/state';
import { Badge, Callout, Datalist, Flex, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { decodeWebhookBody } from '../../../scenes/callbacks/shared';

let getHttpMethodColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'green' as const;
    case 'POST':
      return 'blue' as const;
    case 'PUT':
      return 'orange' as const;
    case 'PATCH':
      return 'purple' as const;
    case 'DELETE':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
};

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

        <Box title="Request URL">
          {data.details ? (
            <Flex align="center" gap={10}>
              <Badge color={getHttpMethodColor(data.details.method)}>
                {data.details.method.toUpperCase()}
              </Badge>
              <Text size="2" style={{ wordBreak: 'break-all' }}>
                {data.details.url}
              </Text>
            </Flex>
          ) : (
            <Text size="2" color="gray600">
              This event has no request payload.
            </Text>
          )}
        </Box>

        {data.details ? (
          <>
            <Spacer height={20} />

            <Box title="Request Body" noPadding={!!decodedBody}>
              {decodedBody ? (
                decodedBody.json !== null ? (
                  <CodeBlock
                    code={decodedBody.json as any}
                    language="json"
                    variant="seamless"
                    padding="15px"
                  />
                ) : (
                  <Text size="1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {decodedBody.text}
                  </Text>
                )
              ) : (
                <Text size="2" color="gray600">
                  This request did not include a body.
                </Text>
              )}
            </Box>

            <Spacer height={20} />

            <Box title="Request Headers">
              {Object.entries(data.details.headers).length ? (
                <Datalist
                  items={Object.entries(data.details.headers).map(([name, value]) => {
                    let presentedValue = Array.isArray(value)
                      ? value.join(', ')
                      : String(value);

                    if (name.toLowerCase() === 'accept') {
                      presentedValue = presentedValue
                        .split(',')
                        .map(v => v.trim())
                        .join(', ');
                    }

                    return {
                      label: name,
                      value: presentedValue
                    };
                  })}
                />
              ) : (
                <Text size="2" color="gray600">
                  This request did not include headers.
                </Text>
              )}
            </Box>
          </>
        ) : null}
      </DetailsOverviewLayout>
    );
  });
};
