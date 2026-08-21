import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallbackNotification,
  useCallbackNotifications,
  useCurrentInstance
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Callout,
  Datalist,
  Panel,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiArrowDownLine, RiArrowUpLine, RiTimeLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  formatDuration,
  formatJsonTextForDisplay,
  getMethodBadgeColor,
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
  MethodBadge,
  RequestCard,
  RequestList,
  RequestMeta,
  RequestMetaItem,
  RequestTopRow,
  SectionSubHeading,
  Url
} from '../providerInvocations/styled';
import { RouterPanel } from '../routerPanel';

let CALLBACK_NOTIFICATIONS_POLL_MS = 3000;

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

let NotificationAttempts = ({
  destination,
  eventRequest,
  attempts
}: {
  destination: {
    webhook?: {
      url?: string | null;
      method?: string | null;
    } | null;
  };
  eventRequest:
    | {
        body?: string | null;
        headers?: { key: string; value: string }[] | null;
      }
    | null
    | undefined;
  attempts: {
    id: string;
    status: string;
    attemptNumber: number;
    durationMs: number;
    error?: unknown;
    response?: {
      statusCode: number;
      body?: string | null;
      headers?: { key: string; value: string }[] | null;
    } | null;
    createdAt: Date;
  }[];
}) => {
  if (!attempts.length) return null;

  let method = destination.webhook?.method ?? 'POST';
  let url = destination.webhook?.url ?? null;

  return (
    <Box
      title="Delivery Attempts"
      description="Each recorded attempt for this notification delivery, including the outbound request and captured response."
    >
      <RequestList>
        {attempts.map(attempt => (
          <RequestCard key={attempt.id} style={{ padding: 0, border: 'none' }}>
            <RequestTopRow>
              <MethodBadge color={getMethodBadgeColor(method)}>{method}</MethodBadge>
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

            <ExchangePart
              label="Response"
              icon={<RiArrowDownLine />}
              headers={attempt.response?.headers}
              body={attempt.response?.body}
            />

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

export let CallbackLogsList = (p: { callbackId: string | undefined }) => {
  return (
    <>
      {/* <Title as="h2" size="5" weight="strong">
        Logs
      </Title>
      <Text size="2" weight="medium" color="gray600">
        These logs show delivery attempts Metorial has made for this callback and the destination
        each notification targeted.
      </Text>
      <Spacer height={20} /> */}

      <CallbackNotificationsTable callbackId={p.callbackId} details />

      <RouterPanel param="notification_id" width={1000}>
        {notificationId => (
          <>
            <Panel.Header>
              <Panel.Title>Notification Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Notification notificationId={notificationId!} callbackId={p.callbackId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

export let CallbackNotificationsTable = ({
  callbackId,
  destinationId,
  details,
  onNotificationClick,
  pollWhileWaiting = true
}: {
  callbackId: string | undefined;
  destinationId?: string;
  details?: boolean;
  onNotificationClick?: (notificationId: string) => void;
  pollWhileWaiting?: boolean;
}) => {
  let instance = useCurrentInstance();
  let notifications = useCallbackNotifications(instance.data?.id, callbackId, {
    order: 'desc',
    ...(destinationId ? { destinationId } : {})
  });
  let [_, setSearchParams] = useSearchParams();
  let shouldPollNotifications =
    !!notifications.data &&
    pollWhileWaiting &&
    (notifications.data.items.length === 0 ||
      notifications.data.items.some(notification =>
        ['pending', 'retrying'].includes(notification.status)
      ));

  useEffect(() => {
    if (!shouldPollNotifications) return;

    let interval = window.setInterval(() => {
      notifications.refetch?.();
    }, CALLBACK_NOTIFICATIONS_POLL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPollNotifications, notifications.refetch]);

  return renderWithPagination(notifications)(notifications => (
    <>
      <Table
        headers={['Status', 'Event', 'Destination', 'Created']}
        data={notifications.data.items.map(notification => ({
          data: [
            getNotificationStatusBadge(notification.status),
            <Text size="2" weight="strong">
              {notification.event.type}
            </Text>,
            <Text size="2">
              {notification.destination.name || notification.destination.webhook?.url || 'N/A'}
            </Text>,
            <RenderDate date={notification.createdAt} />
          ],
          onClick: () =>
            onNotificationClick
              ? onNotificationClick(notification.id)
              : details &&
                setSearchParams(params => {
                  params.set('notification_id', notification.id);
                  return params;
                })
        }))}
      />

      {notifications.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No notifications found for this callback.
        </Text>
      )}
    </>
  ));
};

let Notification = ({
  notificationId,
  callbackId
}: {
  notificationId: string;
  callbackId: string;
}) => {
  let instance = useCurrentInstance();
  let notification = useCallbackNotification(instance.data?.id, callbackId, notificationId);

  let eventRequest = useMemo(
    () => formatJson(notification.data?.event.request?.body ?? {}),
    [notification.data?.event.request]
  );
  let error = useMemo(() => formatJson(notification.data?.error), [notification.data?.error]);
  let attempts = notification.data?.attempts ?? [];

  return (
    <div>
      {renderWithLoader({ notification })(({ notification }) => (
        <>
          <Attributes
            itemWidth="300px"
            attributes={[
              {
                label: 'Status',
                content: getNotificationStatusBadge(notification.data.status)
              },
              {
                label: 'Attempts',
                content: `${attempts.length} / ${notification.data.destination.retry.maxAttempts}`
              },
              {
                label: 'Notification ID',
                content: <ID id={notification.data.id} />
              },
              {
                label: 'Event',
                content: notification.data.event.type
              },
              {
                label: 'Destination',
                content: notification.data.destination.name
              },
              {
                label: 'Next Attempt At',
                content: notification.data.nextAttemptAt ? (
                  <RenderDate date={notification.data.nextAttemptAt} />
                ) : (
                  'N/A'
                )
              }
            ]}
          />

          <Spacer height={15} />

          <Box
            title="Destination"
            description="The destination selected for this notification delivery."
          >
            <Datalist
              items={[
                { label: 'Name', value: notification.data.destination.name },
                {
                  label: 'URL',
                  value: notification.data.destination.webhook?.url ?? 'N/A'
                },
                {
                  label: 'Method',
                  value: notification.data.destination.webhook?.method ?? 'N/A'
                },
                {
                  label: 'Destination ID',
                  value: <ID id={notification.data.destination.id} />
                }
              ]}
            />
          </Box>

          <Spacer height={15} />

          <Box
            title="Event Request"
            description="The event payload stored with the notification delivery."
          >
            <CodeBlock language="json" code={eventRequest} />

            <Spacer height={15} />

            <Text size="2" weight="strong">
              Request Headers
            </Text>

            <Spacer height={10} />

            <Datalist
              items={
                notification.data?.event.request?.headers?.map(header => ({
                  label: header.key,
                  value: header.value
                })) ?? []
              }
            />
          </Box>

          {attempts.length > 0 && (
            <>
              <Spacer height={15} />

              <NotificationAttempts
                destination={notification.data.destination}
                eventRequest={notification.data.event.request}
                attempts={attempts}
              />
            </>
          )}

          {notification.data.error && (
            <>
              <Spacer height={15} />

              <Box
                title="Delivery Error"
                description="The most recent delivery error for this notification."
              >
                <CodeBlock language="json" code={error} />
              </Box>
            </>
          )}

          {notification.data.status === 'retrying' && (
            <>
              <Spacer height={15} />
              <Callout color="orange">
                This notification is scheduled to retry until delivery succeeds or the retry
                policy is exhausted.
              </Callout>
            </>
          )}
        </>
      ))}
    </div>
  );
};
