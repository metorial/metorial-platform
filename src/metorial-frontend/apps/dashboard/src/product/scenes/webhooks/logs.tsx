import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useAllCallbacks,
  useCurrentInstance,
  useWebhookEvent,
  useWebhookEvents,
  webhookDestinationsLoader
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Datalist,
  Flex,
  Input,
  Panel,
  RenderDate,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiArrowDownLine, RiArrowUpLine, RiTimeLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  formatDuration,
  formatJsonTextForDisplay,
  getResponseBadgeColor,
  headersToItems,
  isEmptyValue,
  normalizeContentType,
  prismLanguageForContentType,
  renderJsonCodeBlock
} from '../providerInvocations/helpers';
import {
  BodySubHeader,
  ContentTypeTag,
  Divider,
  ExchangeLabel,
  ExchangeSide,
  HeadersCard,
  RequestCard,
  RequestList,
  RequestMeta,
  RequestMetaItem,
  RequestTopRow,
  SectionSubHeading,
  Url
} from '../providerInvocations/styled';
import { RouterPanel } from '../routerPanel';
import {
  getWebhookDestinationDisplay,
  getCallbackFilterItems,
  getWebhookSourceDisplay,
  type CallbackLabel,
  type WebhookSource
} from './webhookDisplay';

export { getWebhookDestinationDisplay, getWebhookSourceDisplay } from './webhookDisplay';

let WEBHOOK_EVENTS_POLL_MS = 3000;

let formatJson = (value: unknown) => {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

export let getNotificationStatusBadge = (status?: string) => {
  let color: 'blue' | 'gray' | 'red' | 'orange' =
    status === 'delivered'
      ? 'blue'
      : status === 'failed'
        ? 'red'
        : status === 'retrying'
          ? 'orange'
          : 'gray';

  return <Badge color={color}>{status ?? 'unknown'}</Badge>;
};

export let getNotificationAttemptStatusBadge = (status?: string) => {
  let color: 'green' | 'gray' | 'red' =
    status === 'succeeded' ? 'green' : status === 'failed' ? 'red' : 'gray';

  return <Badge color={color}>{status ?? 'unknown'}</Badge>;
};

let renderStructuredBody = (body: unknown, contentType?: string | null): ReactNode => {
  let normalizedContentType = normalizeContentType(contentType);
  let tag = normalizedContentType ? (
    <ContentTypeTag>{normalizedContentType}</ContentTypeTag>
  ) : null;

  if (
    normalizedContentType === 'application/x-www-form-urlencoded' &&
    typeof body === 'string'
  ) {
    let params: { label: ReactNode; value: ReactNode }[] = [];
    try {
      let searchParams = new URLSearchParams(body);
      searchParams.forEach((value, key) => {
        params.push({ label: key, value });
      });
    } catch {}

    if (params.length > 0) {
      return (
        <>
          <BodySubHeader>
            <SectionSubHeading>Body</SectionSubHeading>
            {tag}
          </BodySubHeader>
          <HeadersCard>
            <Datalist items={params} />
          </HeadersCard>
        </>
      );
    }
  }

  if (normalizedContentType?.includes('json') && typeof body === 'string') {
    let formattedJson = formatJsonTextForDisplay(body);

    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <CodeBlock
          lineNumbers={false}
          code={formattedJson.code}
          language="json"
          padding="12px"
        />
      </>
    );
  }

  if (typeof body === 'string') {
    let formattedJson = formatJsonTextForDisplay(body);

    if (formattedJson.isValid || formattedJson.isBestEffort) {
      return (
        <>
          <BodySubHeader>
            <SectionSubHeading>Body</SectionSubHeading>
            {tag}
          </BodySubHeader>
          <CodeBlock
            lineNumbers={false}
            code={formattedJson.code}
            language="json"
            padding="12px"
          />
        </>
      );
    }

    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <CodeBlock
          lineNumbers={false}
          code={body}
          language={prismLanguageForContentType(normalizedContentType)}
          padding="12px"
        />
      </>
    );
  }

  return (
    <>
      <BodySubHeader>
        <SectionSubHeading>Body</SectionSubHeading>
        {tag}
      </BodySubHeader>
      {renderJsonCodeBlock(body)}
    </>
  );
};

let getContentType = (headers: unknown) => {
  if (Array.isArray(headers)) {
    let header = headers.find(
      item =>
        item &&
        typeof item === 'object' &&
        'key' in item &&
        String((item as { key?: unknown }).key).toLowerCase() === 'content-type'
    ) as { value?: unknown } | undefined;

    return normalizeContentType(header?.value);
  }

  if (headers && typeof headers === 'object') {
    return normalizeContentType(
      Object.entries(headers as Record<string, unknown>).find(
        ([key]) => key.toLowerCase() === 'content-type'
      )?.[1] ?? null
    );
  }

  return null;
};

let ExchangePart = ({
  label,
  icon,
  headers,
  body
}: {
  label: string;
  icon: ReactNode;
  headers: unknown;
  body: unknown;
}) => {
  let hasHeaders = !isEmptyValue(headers);
  let hasBody = !isEmptyValue(body);
  let headerItems = hasHeaders ? headersToItems(headers) : null;
  let contentType = getContentType(headers);

  if (!hasHeaders && !hasBody) {
    return (
      <ExchangeSide>
        <ExchangeLabel>
          {icon}
          {label}
        </ExchangeLabel>
        <Text size="1" color="gray600">
          No payload captured.
        </Text>
      </ExchangeSide>
    );
  }

  return (
    <ExchangeSide>
      <ExchangeLabel>
        {icon}
        {label}
      </ExchangeLabel>

      {headerItems ? (
        <ExchangeSide>
          <SectionSubHeading>Headers</SectionSubHeading>
          <HeadersCard>
            <Datalist items={headerItems} />
          </HeadersCard>
        </ExchangeSide>
      ) : hasHeaders ? (
        <ExchangeSide>
          <SectionSubHeading>Headers</SectionSubHeading>
          {renderJsonCodeBlock(headers)}
        </ExchangeSide>
      ) : null}

      {hasBody ? <ExchangeSide>{renderStructuredBody(body, contentType)}</ExchangeSide> : null}
    </ExchangeSide>
  );
};

type WebhookAttempt = {
  id: string;
  status: 'succeeded' | 'failed';
  attemptNumber: number;
  durationMs: number;
  error: { code: string; message: string } | null;
  response: { statusCode: number } | null;
  createdAt: Date;
};

export let WebhookSourceCell = ({
  source,
  callbacks
}: {
  source: WebhookSource;
  callbacks: readonly CallbackLabel[];
}) => {
  let display = getWebhookSourceDisplay(source, callbacks);

  return (
    <Flex gap={6} align="center">
      <Text size="2">{display.label}</Text>
      {display.archived ? <Badge color="gray">Archived</Badge> : null}
    </Flex>
  );
};

let WebhookDeliveryAttempts = ({
  destination,
  eventRequest,
  attempts
}: {
  destination: { name: string; url: string } | null;
  eventRequest: { body: string; headers: { key: string; value: string }[] | null } | null;
  attempts: WebhookAttempt[];
}) => {
  if (!attempts.length) return null;

  let url = destination?.url ?? null;

  return (
    <Box
      title="Delivery Attempts"
      description="Each recorded attempt for this webhook delivery, including the outbound request and captured response status."
    >
      <RequestList>
        {attempts.map(attempt => (
          <RequestCard key={attempt.id} style={{ padding: 0, border: 'none' }}>
            <RequestTopRow>
              {url ? <Url>{url}</Url> : null}
              {attempt.response ? (
                <Badge color={getResponseBadgeColor(attempt.response.statusCode)}>
                  {attempt.response.statusCode}
                </Badge>
              ) : null}
              {getNotificationAttemptStatusBadge(attempt.status)}
            </RequestTopRow>

            <RequestMeta>
              <RequestMetaItem>
                <Text size="1" weight="strong">
                  Attempt #{attempt.attemptNumber}
                </Text>
              </RequestMetaItem>
              <RequestMetaItem>
                <RiTimeLine size={12} />
                {formatDuration(attempt.durationMs) ?? `${attempt.durationMs} ms`}
              </RequestMetaItem>
              <RequestMetaItem>
                <RenderDate date={attempt.createdAt} />
              </RequestMetaItem>
            </RequestMeta>

            <Divider />

            <ExchangePart
              label="Request"
              icon={<RiArrowUpLine />}
              headers={eventRequest?.headers}
              body={eventRequest?.body}
            />

            <ExchangeSide>
              <ExchangeLabel>
                <RiArrowDownLine />
                Response
              </ExchangeLabel>
              {attempt.response ? (
                <Datalist
                  items={[{ label: 'Status code', value: `${attempt.response.statusCode}` }]}
                />
              ) : (
                <Text size="1" color="gray600">
                  No response captured.
                </Text>
              )}
            </ExchangeSide>

            {!!attempt.error && (
              <>
                <Divider />
                <ExchangeSide>
                  <ExchangeLabel>Error</ExchangeLabel>
                  <CodeBlock
                    lineNumbers={false}
                    language="json"
                    code={formatJson(attempt.error)}
                    padding="12px"
                  />
                </ExchangeSide>
              </>
            )}
          </RequestCard>
        ))}
      </RequestList>
    </Box>
  );
};

let DestinationFilter = ({
  instanceId,
  value,
  onChange
}: {
  instanceId: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
}) => {
  let [search, setSearch] = useState('');
  let [cursor, setCursor] = useState<{ before?: string; after?: string }>({});
  let [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  let destinations = webhookDestinationsLoader.use(
    instanceId ? { instanceId, limit: 25, order: 'desc', ...cursor } : null
  );
  let normalizedSearch = search.trim().toLowerCase();
  let items = (destinations.data?.items ?? []).filter(destination =>
    normalizedSearch
      ? `${destination.name} ${destination.url}`.toLowerCase().includes(normalizedSearch)
      : true
  );
  let selectedIsOnPage = items.some(destination => destination.id === value);

  return (
    <Flex direction="column" gap={6} style={{ minWidth: 260 }}>
      <Input
        label="Search destinations"
        hideLabel
        placeholder="Search destination page..."
        value={search}
        onChange={event => setSearch(event.target.value)}
      />
      <Select
        label="Destination"
        value={value}
        onChange={nextValue => {
          onChange(nextValue);
          setSelectedLabel(
            items.find(destination => destination.id === nextValue)?.name ?? null
          );
        }}
        items={[
          { id: 'all', label: 'All destinations' },
          ...(!selectedIsOnPage && value !== 'all'
            ? [{ id: value, label: selectedLabel ?? value }]
            : []),
          ...items.map(destination => ({
            id: destination.id,
            label: `${destination.name} (${destination.url})`
          }))
        ]}
      />
      <Flex gap={6}>
        <Button
          size="1"
          variant="outline"
          disabled={!destinations.data?.pagination.hasMoreBefore}
          onClick={() => {
            let first = destinations.data?.items[0];
            if (first) setCursor({ before: first.id });
          }}
        >
          Previous
        </Button>
        <Button
          size="1"
          variant="outline"
          disabled={!destinations.data?.pagination.hasMoreAfter}
          onClick={() => {
            let last = destinations.data?.items[destinations.data.items.length - 1];
            if (last) setCursor({ after: last.id });
          }}
        >
          Next
        </Button>
      </Flex>
    </Flex>
  );
};

export let WebhookLogsList = () => {
  let instance = useCurrentInstance();
  let callbacks = useAllCallbacks(instance.data?.id);
  let [eventType, setEventType] = useState('');
  let [status, setStatus] = useState('all');
  let [callbackId, setCallbackId] = useState('all');
  let [destinationId, setDestinationId] = useState('all');
  let events = useWebhookEvents(instance.data?.id, {
    order: 'desc',
    ...(eventType.trim() ? { type: eventType.trim() } : {}),
    ...(status === 'all' ? {} : { status: status as 'pending' | 'delivered' | 'failed' }),
    ...(callbackId === 'all' ? {} : { callbackId }),
    ...(destinationId === 'all' ? {} : { destinationId })
  });
  let [_, setSearchParams] = useSearchParams();
  let shouldPollEvents =
    !!events.data &&
    (events.data.items.length === 0 ||
      events.data.items.some(event => event.status === 'pending'));

  useEffect(() => {
    if (!shouldPollEvents) return;

    let interval = window.setInterval(() => events.refetch?.(), WEBHOOK_EVENTS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [shouldPollEvents, events.refetch]);

  return (
    <>
      <Flex gap={10} align="end" style={{ marginBottom: 15, flexWrap: 'wrap' }}>
        <Input
          label="Event type"
          placeholder="e.g. issue.created"
          value={eventType}
          onChange={event => setEventType(event.target.value)}
          style={{ maxWidth: 240 }}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          items={[
            { id: 'all', label: 'All statuses' },
            { id: 'pending', label: 'Pending' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'failed', label: 'Failed' }
          ]}
        />
        <Select
          label="Callback"
          value={callbackId}
          onChange={setCallbackId}
          items={getCallbackFilterItems(callbacks.data ?? [])}
        />
        <DestinationFilter
          instanceId={instance.data?.id}
          value={destinationId}
          onChange={setDestinationId}
        />
      </Flex>

      {renderWithLoader({ callbacks })(({ callbacks }) =>
        renderWithPagination(events)(events => (
          <>
            <Table
              headers={['Type', 'Status', 'Deliveries', 'Source', 'Created']}
              data={events.data.items.map(event => ({
                data: [
                  <Text size="2" weight="strong">
                    {event.type}
                  </Text>,
                  getNotificationStatusBadge(event.status),
                  <Text size="2">
                    {event.deliverySuccessCount} delivered / {event.deliveryFailureCount}{' '}
                    failed / {event.deliveryDestinationCount ?? event.deliveries?.length ?? 0}{' '}
                    total
                  </Text>,
                  <WebhookSourceCell
                    source={event.source as WebhookSource}
                    callbacks={callbacks.data}
                  />,
                  <RenderDate date={event.createdAt} />
                ],
                onClick: () =>
                  setSearchParams(params => {
                    params.set('webhook_event_id', event.id);
                    return params;
                  })
              }))}
            />
            {events.data.items.length === 0 ? (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                No webhook events found.
              </Text>
            ) : null}
          </>
        ))
      )}

      <RouterPanel param="webhook_event_id" width={1000}>
        {webhookEventId => (
          <>
            <Panel.Header>
              <Panel.Title>Webhook Event Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <WebhookEventDetails
                webhookEventId={webhookEventId!}
                callbacks={callbacks.data ?? []}
              />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let WebhookEventDetails = ({
  webhookEventId,
  callbacks
}: {
  webhookEventId: string;
  callbacks: CallbackLabel[];
}) => {
  let instance = useCurrentInstance();
  let event = useWebhookEvent(instance.data?.id, webhookEventId);
  let requestBody = useMemo(
    () => formatJson(event.data?.request?.body ?? {}),
    [event.data?.request]
  );

  return (
    <div>
      {renderWithLoader({ event })(({ event }) => (
        <>
          <Attributes
            itemWidth="300px"
            attributes={[
              {
                label: 'Status',
                content: getNotificationStatusBadge(event.data.status)
              },
              {
                label: 'Event ID',
                content: <ID id={event.data.id} />
              },
              {
                label: 'Type',
                content: event.data.type
              },
              {
                label: 'Source',
                content: (
                  <WebhookSourceCell
                    source={event.data.source as WebhookSource}
                    callbacks={callbacks}
                  />
                )
              },
              {
                label: 'Deliveries',
                content: `${event.data.deliverySuccessCount} delivered / ${event.data.deliveryFailureCount} failed`
              },
              {
                label: 'Created At',
                content: <RenderDate date={event.data.createdAt} />
              }
            ]}
          />

          <Spacer height={15} />

          <Box
            title="Event Request"
            description="The request payload stored for this webhook event."
          >
            <CodeBlock language="json" code={requestBody} />

            <Spacer height={15} />

            <Text size="2" weight="strong">
              Request Headers
            </Text>

            <Spacer height={10} />

            <Datalist
              items={
                event.data.request?.headers?.map(header => ({
                  label: header.key,
                  value: header.value
                })) ?? []
              }
            />
          </Box>

          {(event.data.deliveries ?? []).map(delivery => (
            <div key={delivery.id}>
              <Spacer height={15} />
              <Box
                title={getWebhookDestinationDisplay(delivery.destination).name}
                description={getWebhookDestinationDisplay(delivery.destination).description}
              >
                <Datalist
                  items={[
                    { label: 'Status', value: getNotificationStatusBadge(delivery.status) },
                    { label: 'Attempts', value: `${delivery.attemptCount}` },
                    {
                      label: 'Destination ID',
                      value: delivery.destination ? (
                        <ID id={delivery.destination.id} />
                      ) : (
                        'Unknown destination'
                      )
                    },
                    {
                      label: 'Next attempt',
                      value: delivery.nextAttemptAt ? (
                        <RenderDate date={delivery.nextAttemptAt} />
                      ) : (
                        'N/A'
                      )
                    }
                  ]}
                />
                {delivery.error ? (
                  <>
                    <Spacer height={12} />
                    <Callout color="red">
                      {delivery.error.code}: {delivery.error.message}
                    </Callout>
                  </>
                ) : null}
                {delivery.status === 'retrying' ? (
                  <>
                    <Spacer height={12} />
                    <Callout color="orange">This delivery is scheduled to retry.</Callout>
                  </>
                ) : null}
                <Spacer height={15} />
                <WebhookDeliveryAttempts
                  destination={delivery.destination}
                  eventRequest={event.data.request}
                  attempts={delivery.attempts}
                />
              </Box>
            </div>
          ))}
        </>
      ))}
    </div>
  );
};
