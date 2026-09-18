import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { PageHeader } from '@metorial/layout';
import {
  useCurrentOrganization,
  useEventDelivery,
  useEventDeliveryAttempt
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Datalist,
  Flex,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { useInterval } from 'react-use';
import styled from 'styled-components';
import {
  canRetryEventDelivery,
  decodeDeliveryBody,
  getEventDeliveryActionLabel
} from '../../../scenes/callbacks/shared';

let AttemptList = styled.div`
  display: grid;
  gap: 32px;
  min-width: 0;
`;

let AttemptGroup = styled.section`
  min-width: 0;
`;

let LongValue = styled.span`
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

let BodyText = styled.pre`
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 14px;
`;

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

let AttemptDetails = ({
  organizationId,
  attemptId
}: {
  organizationId: string;
  attemptId: string;
}) => {
  let attempt = useEventDeliveryAttempt(organizationId, attemptId);

  return renderWithLoader({ attempt })(({ attempt }) => {
    let requestBody = decodeDeliveryBody(attempt.data.request?.body);
    let responseBody = decodeDeliveryBody(attempt.data.response?.body);

    return (
      <AttemptGroup>
        <PageHeader
          size="4"
          title={`Attempt ${attempt.data.attemptNumber}`}
          description={`Completed in ${attempt.data.durationMs} ms`}
          actions={
            <Badge color={attempt.data.status === 'succeeded' ? 'blue' : 'red'}>
              {attempt.data.status === 'succeeded' ? 'Succeeded' : 'Failed'}
            </Badge>
          }
        />

        {attempt.data.error ? (
          <>
            <Callout color="red">
              <span>
                <strong>{attempt.data.error.code}</strong> — {attempt.data.error.message}
              </span>
            </Callout>
            <Spacer height={15} />
          </>
        ) : null}

        <Box title="Attempt Details">
          <Datalist
            items={[
              { label: 'Started', value: <RenderDate date={attempt.data.startedAt} /> },
              { label: 'Completed', value: <RenderDate date={attempt.data.completedAt} /> },
              {
                label: 'Retryable',
                value: attempt.data.isRetryable ? 'Yes' : 'No'
              }
            ]}
          />
        </Box>

        <Spacer height={20} />

        <PageHeader size="3" title="Request Details" />

        <Box title="Request URL">
          {attempt.data.request ? (
            <Flex align="center" gap={10} style={{ minWidth: 0 }}>
              <Badge color={getHttpMethodColor(attempt.data.request.method)}>
                {attempt.data.request.method.toUpperCase()}
              </Badge>
              <Text size="2" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {attempt.data.request.url}
              </Text>
            </Flex>
          ) : (
            <Text size="2" color="gray600">
              Request details are unavailable for this attempt.
            </Text>
          )}
        </Box>

        <Spacer height={20} />

        <Box title="Request Body" noPadding={!!requestBody}>
          {requestBody ? (
            requestBody.json !== null ? (
              <CodeBlock
                code={requestBody.json}
                language="json"
                variant="seamless"
                padding="15px"
              />
            ) : (
              <BodyText>{requestBody.text}</BodyText>
            )
          ) : (
            <Text size="2" color="gray600">
              This request did not include a body.
            </Text>
          )}
        </Box>

        <Spacer height={20} />

        <Box title="Request Headers">
          {attempt.data.request?.headers.length ? (
            <Datalist
              items={attempt.data.request.headers.map(header => ({
                label: header.key,
                value: <LongValue>{header.value}</LongValue>
              }))}
            />
          ) : (
            <Text size="2" color="gray600">
              This request did not include headers.
            </Text>
          )}
        </Box>

        <Spacer height={20} />

        <PageHeader size="3" title="Response Details" />

        <Box title="Response">
          {attempt.data.response ? (
            <Datalist
              items={[
                {
                  label: 'Status Code',
                  value: `${attempt.data.response.statusCode}`
                }
              ]}
            />
          ) : (
            <Text size="2" color="gray600">
              The destination did not return an HTTP response.
            </Text>
          )}
        </Box>

        {attempt.data.response ? (
          <>
            <Spacer height={20} />

            <Box title="Response Body" noPadding={!!responseBody?.json}>
              {responseBody ? (
                responseBody.json !== null ? (
                  <CodeBlock
                    code={responseBody.json}
                    language="json"
                    variant="seamless"
                    padding="15px"
                  />
                ) : (
                  <BodyText>{responseBody.text}</BodyText>
                )
              ) : (
                <Text size="2" color="gray600">
                  This response did not include a body.
                </Text>
              )}
              {attempt.data.response.isBodyTruncated ? (
                <>
                  <Spacer height={12} />
                  <Callout color="orange">The response body was truncated to 16 KB.</Callout>
                </>
              ) : null}
            </Box>

            <Spacer height={20} />

            <Box title="Response Headers">
              {attempt.data.response.headers?.length ? (
                <Datalist
                  items={attempt.data.response.headers.map(header => ({
                    label: header.key,
                    value: <LongValue>{header.value}</LongValue>
                  }))}
                />
              ) : (
                <Text size="2" color="gray600">
                  This response did not include headers.
                </Text>
              )}
            </Box>
          </>
        ) : null}
      </AttemptGroup>
    );
  });
};

export let EventDeliveryPage = () => {
  let organization = useCurrentOrganization();
  let { eventDeliveryId } = useParams();
  let delivery = useEventDelivery(organization.data?.id, eventDeliveryId);
  let retryDelivery = delivery.useRetryMutator();

  let isActive = delivery.data?.status === 'retrying' || delivery.data?.status === 'pending';
  useInterval(
    () => {
      if (isActive) delivery.refetch();
    },
    isActive ? 5000 : null
  );

  return renderWithLoader({ organization, delivery })(({ organization, delivery }) => {
    let canRetry = canRetryEventDelivery(delivery.data.status);

    return (
      <DetailsOverviewLayout>
        {delivery.data.status === 'failed' || delivery.data.status === 'retrying' ? (
          <>
            <Callout color={delivery.data.status === 'failed' ? 'red' : 'orange'}>
              <span>
                <strong>
                  {delivery.data.status === 'failed'
                    ? 'Webhook delivery failed.'
                    : 'Webhook delivery is being retried.'}
                </strong>{' '}
                {delivery.data.error?.message ??
                  delivery.data.error?.code ??
                  'Review the attempts below for details.'}
              </span>
            </Callout>
            <Spacer height={20} />
          </>
        ) : null}

        <Box
          title="Delivery"
          rightActions={
            canRetry ? (
              <Button
                size="2"
                loading={retryDelivery.isLoading}
                success={retryDelivery.isSuccess}
                onClick={async () => {
                  let [retried] = await retryDelivery.mutate({});
                  if (retried) await delivery.refetch();
                }}
              >
                {getEventDeliveryActionLabel(delivery.data.status)}
              </Button>
            ) : undefined
          }
        >
          <Datalist
            items={[
              { label: 'Event Type', value: delivery.data.eventType },
              {
                label: 'Attempts',
                value: `${delivery.data.attemptCount}`
              },
              {
                label: 'Next Attempt',
                value: delivery.data.nextAttemptAt ? (
                  <RenderDate date={delivery.data.nextAttemptAt} />
                ) : (
                  '-'
                )
              },
              {
                label: 'Completed',
                value: delivery.data.completedAt ? (
                  <RenderDate date={delivery.data.completedAt} />
                ) : (
                  '-'
                )
              }
            ]}
          />
          <retryDelivery.RenderError />
        </Box>

        <Spacer height={20} />

        <AttemptList>
          {delivery.data.attempts.length ? (
            [...delivery.data.attempts]
              .sort((a, b) => a.attemptNumber - b.attemptNumber)
              .map(attempt => (
                <AttemptDetails
                  key={attempt.id}
                  organizationId={organization.data.id}
                  attemptId={attempt.id}
                />
              ))
          ) : (
            <Box title="Attempts">
              <Text size="2" color="gray600">
                No delivery attempts have been made yet.
              </Text>
            </Box>
          )}
        </AttemptList>
      </DetailsOverviewLayout>
    );
  });
};
