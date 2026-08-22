import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallbackEvent,
  useCallbackEvents,
  useAllCallbacks,
  useCurrentInstance,
  useProviderInvocations
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Datalist,
  Error,
  Flex,
  Panel,
  RenderDate,
  Select,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiArrowUpLine, RiTimeLine } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProviderInvocationEntry } from '../providerInvocations/entry';
import {
  formatJsonTextForDisplay,
  getMethodBadgeColor,
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
  MethodBadge,
  RequestCard,
  RequestMeta,
  RequestMetaItem,
  RequestTopRow,
  SectionSubHeading,
  Url
} from '../providerInvocations/styled';
import { RouterPanel } from '../routerPanel';
import { getCallbackFilterItems } from './webhookDisplay';

let CALLBACK_EVENTS_POLL_MS = 3000;

let formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

let getLifecycleStatusBadge = (status?: string) => {
  let color: 'green' | 'blue' | 'gray' | 'red' | 'orange' =
    status === 'succeeded'
      ? 'blue'
      : status === 'failed'
        ? 'red'
        : status === 'retrying'
          ? 'orange'
          : status === 'processing'
            ? 'blue'
            : 'gray';

  return <Badge color={color}>{status ?? 'unknown'}</Badge>;
};

type CallbackEventLifecycleFields = {
  status?: 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed' | 'skipped';
  error?: {
    code: string | null;
    message: string | null;
  } | null;
};

let getLifecycleFields = (event: unknown) => event as CallbackEventLifecycleFields;

type HttpCallbackEventInput = {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  payload?: unknown;
  body?: unknown;
  receivedAt?: unknown;
};

let isHttpEventInput = (input: unknown): input is HttpCallbackEventInput => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;

  let record = input as Record<string, unknown>;
  return typeof record.url === 'string' && typeof record.method === 'string';
};

let getHeaderValue = (headers: unknown, name: string) => {
  let normalizedName = name.toLowerCase();

  if (Array.isArray(headers)) {
    for (let header of headers) {
      if (Array.isArray(header) && header.length >= 2) {
        if (String(header[0]).toLowerCase() === normalizedName) return header[1];
      } else if (header && typeof header === 'object') {
        let item = header as { key?: unknown; name?: unknown; value?: unknown };
        let key = item.key ?? item.name;
        if (key != null && String(key).toLowerCase() === normalizedName) return item.value;
      }
    }
  }

  if (headers && typeof headers === 'object') {
    for (let [key, value] of Object.entries(headers as Record<string, unknown>)) {
      if (key.toLowerCase() === normalizedName) return value;
    }
  }

  return null;
};

let renderHttpBody = (body: unknown, contentType: string | null) => {
  let tag = contentType ? <ContentTypeTag>{contentType}</ContentTypeTag> : null;

  if (isEmptyValue(body)) {
    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <Text size="1" color="gray600">
          No body captured.
        </Text>
      </>
    );
  }

  if (contentType === 'application/x-www-form-urlencoded' && typeof body === 'string') {
    let params: { label: string; value: string }[] = [];

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

  if (contentType?.includes('json') && typeof body === 'string') {
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
    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <CodeBlock
          lineNumbers={false}
          code={body}
          language={prismLanguageForContentType(contentType)}
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

let HttpEventInput = ({ input }: { input: HttpCallbackEventInput }) => {
  let method = typeof input.method === 'string' ? input.method.toUpperCase() : 'REQUEST';
  let url = typeof input.url === 'string' ? input.url : null;
  let headerItems = headersToItems(input.headers);
  let contentType = normalizeContentType(getHeaderValue(input.headers, 'content-type'));
  let body = 'payload' in input ? input.payload : input.body;
  let receivedAtDate =
    typeof input.receivedAt === 'string' ? new Date(input.receivedAt) : null;
  let receivedAt =
    receivedAtDate && !Number.isNaN(receivedAtDate.getTime()) ? receivedAtDate : null;

  return (
    <RequestCard style={{ padding: 0, border: 'none' }}>
      <RequestTopRow>
        <MethodBadge color={getMethodBadgeColor(method)}>{method}</MethodBadge>
        {url ? <Url>{url}</Url> : null}
      </RequestTopRow>

      {receivedAt ? (
        <RequestMeta>
          <RequestMetaItem>
            <RiTimeLine size={12} />
            <RenderDate date={receivedAt} />
          </RequestMetaItem>
        </RequestMeta>
      ) : null}

      <Divider />

      <ExchangeSide>
        <ExchangeLabel>
          <RiArrowUpLine />
          Request
        </ExchangeLabel>

        <ExchangeSide>
          <SectionSubHeading>Headers</SectionSubHeading>
          {headerItems ? (
            <HeadersCard>
              <Datalist items={headerItems} />
            </HeadersCard>
          ) : !isEmptyValue(input.headers) ? (
            renderJsonCodeBlock(input.headers)
          ) : (
            <Text size="1" color="gray600">
              No headers captured.
            </Text>
          )}
        </ExchangeSide>

        <ExchangeSide>{renderHttpBody(body, contentType)}</ExchangeSide>
      </ExchangeSide>
    </RequestCard>
  );
};

let EventProviderInvocations = ({ eventId }: { eventId: string }) => {
  let instance = useCurrentInstance();
  let invocations = useProviderInvocations(instance.data?.id, { callbackEventId: eventId });

  return (
    <Box
      title="Provider Invocations"
      description="Provider-side logs and traces associated with this callback event."
    >
      {renderWithLoader({ invocations })(({ invocations }) =>
        invocations.data.items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {invocations.data.items.map(invocation => (
              <ProviderInvocationEntry key={invocation.id} invocation={invocation} />
            ))}
          </div>
        ) : (
          <Text size="2" color="gray600">
            No provider invocations were captured for this callback event.
          </Text>
        )
      )}
    </Box>
  );
};

type CallbackLabel = {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'deleted';
};

export let CallbackSourceLabel = ({ callback }: { callback?: CallbackLabel }) => {
  if (!callback)
    return (
      <Text size="2" color="gray600">
        Unknown callback
      </Text>
    );

  return (
    <Flex gap={6} align="center">
      <Text size="2">{callback.name}</Text>
      {callback.status === 'archived' ? <Badge color="gray">Archived</Badge> : null}
    </Flex>
  );
};

export let WebhookEventsList = () => {
  let instance = useCurrentInstance();
  let callbacks = useAllCallbacks(instance.data?.id);
  let [callbackId, setCallbackId] = useState('all');
  let events = useCallbackEvents(instance.data?.id, {
    order: 'desc',
    ...(callbackId === 'all' ? {} : { callbackId })
  });
  let [_, setSearchParams] = useSearchParams();
  let shouldPollEvents =
    !!events.data &&
    (events.data.items.length === 0 ||
      events.data.items.some(
        event =>
          !['succeeded', 'failed', 'skipped'].includes(
            getLifecycleFields(event).status ?? 'pending'
          ) || event.deliveryStatus === 'pending'
      ));

  useEffect(() => {
    if (!shouldPollEvents) return;

    let interval = window.setInterval(() => {
      events.refetch?.();
    }, CALLBACK_EVENTS_POLL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPollEvents, events.refetch]);

  return (
    <>
      <Flex gap={10} style={{ marginBottom: 15, maxWidth: 360 }}>
        <Select
          label="Callback"
          value={callbackId}
          onChange={setCallbackId}
          items={getCallbackFilterItems(callbacks.data ?? [])}
        />
      </Flex>

      {renderWithPagination(events)(events => (
        <>
          <Table
            headers={['Status', 'Type', 'Callback', 'Created']}
            data={events.data.items.map(event => ({
              data: [
                getLifecycleStatusBadge(getLifecycleFields(event).status),
                <Text size="2" weight="strong">
                  {event.type || event.triggerKey}
                </Text>,
                <CallbackSourceLabel
                  callback={(callbacks.data ?? []).find(
                    callback => callback.id === event.callbackId
                  )}
                />,
                <RenderDate date={event.createdAt} />
              ],
              onClick: () =>
                setSearchParams(params => {
                  params.set('event_id', event.id);
                  return params;
                })
            }))}
          />

          {events.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No callback events found.
            </Text>
          )}
        </>
      ))}

      <RouterPanel param="event_id" width={1000}>
        {eventId => (
          <>
            <Panel.Header>
              <Panel.Title>Event Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Event eventId={eventId!} callbacks={callbacks.data ?? []} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Event = ({ eventId, callbacks }: { eventId: string; callbacks: CallbackLabel[] }) => {
  let instance = useCurrentInstance();
  let event = useCallbackEvent(instance.data?.id, eventId);

  let input = useMemo(() => formatJson(event.data?.input), [event.data?.input]);
  let output = useMemo(() => formatJson(event.data?.output), [event.data?.output]);

  return (
    <div>
      {renderWithLoader({ event })(({ event }) => {
        let httpInput = isHttpEventInput(event.data.input) ? event.data.input : null;

        return (
          <>
            <Attributes
              itemWidth="300px"
              attributes={[
                {
                  label: 'Lifecycle Status',
                  content: getLifecycleStatusBadge(getLifecycleFields(event.data).status)
                },
                {
                  label: 'Event Type',
                  content: event.data.type || 'N/A'
                },
                {
                  label: 'Trigger Key',
                  content: event.data.triggerKey
                },
                {
                  label: 'Error',
                  content: event.data.error ? (
                    <Error>
                      {event.data.error.code}: {event.data.error.message}
                    </Error>
                  ) : (
                    'N/A'
                  )
                },
                {
                  label: 'Callback Instance ID',
                  content: event.data.callbackInstanceId ? (
                    <ID id={event.data.callbackInstanceId} />
                  ) : (
                    'N/A'
                  )
                },
                {
                  label: 'Callback',
                  content: (
                    <CallbackSourceLabel
                      callback={callbacks.find(
                        callback => callback.id === event.data.callbackId
                      )}
                    />
                  )
                },
                {
                  label: 'Created At',
                  content: <RenderDate date={event.data.createdAt} />
                }
              ]}
            />

            <Spacer height={15} />

            <Box
              title={httpInput ? 'HTTP Request' : 'Input Payload'}
              description={
                httpInput
                  ? 'The request captured for this callback event.'
                  : 'The raw payload captured for this callback event.'
              }
            >
              {httpInput ? (
                <HttpEventInput input={httpInput} />
              ) : (
                <CodeBlock variant="seamless" language="json" code={input} />
              )}
            </Box>

            {event.data?.output && (
              <>
                <Spacer height={15} />

                <Box
                  title="Output Payload"
                  description="The normalized output stored for downstream callback deliveries."
                >
                  <CodeBlock variant="seamless" language="json" code={output} />
                </Box>
              </>
            )}

            <Spacer height={15} />

            <EventProviderInvocations eventId={event.data.id} />
          </>
        );
      })}
    </div>
  );
};
