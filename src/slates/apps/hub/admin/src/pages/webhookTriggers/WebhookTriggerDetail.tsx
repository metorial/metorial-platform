import { renderWithLoader, renderWithPagination } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Datalist,
  Flex,
  Group,
  InlineCopy,
  Input,
  Panel,
  RenderDate,
  Select,
  showModal,
  Spacer,
  Text,
  Title
} from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { EmptyState, LogViewer, MonoCode } from '../../components/styled.js';
import { useWebhookTrigger, useWebhookTriggerEvents } from '../../state/index.js';

let statusColors: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  awaiting_setup: 'gray',
  active: 'green',
  deleted: 'red',
  pending: 'gray',
  failed_retrying: 'blue',
  failed_final: 'red',
  succeeded: 'green'
};

let HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

type EncodedBody = { encoding?: string; content?: string } | null | undefined;

let decodeEncodedBody = (body: EncodedBody) => {
  if (!body?.content) return null;

  try {
    let raw =
      body.encoding === 'base64'
        ? new TextDecoder().decode(
            Uint8Array.from(atob(body.content), char => char.charCodeAt(0))
          )
        : body.content;

    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  } catch {
    return body.content;
  }
};

let getResultBody = (result: unknown, field: 'request' | 'slateResponse'): EncodedBody => {
  if (!result || typeof result !== 'object') return null;
  let event = (result as { event?: unknown }).event;
  if (!event || typeof event !== 'object') return null;
  let container = (event as Record<string, unknown>)[field];
  if (!container || typeof container !== 'object') return null;
  return (container as { body?: EncodedBody }).body;
};

let formatDecodedBody = (body: EncodedBody) => decodeEncodedBody(body) ?? 'No body';

let formatJsonValue = (value: unknown) => {
  if (value === null || value === undefined) return 'None';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

type WebhookTriggerEvent = NonNullable<
  ReturnType<typeof useWebhookTriggerEvents>['data']
>['items'][number];

let DecodedBodyBlock = ({ label, body }: { label: string; body: EncodedBody }) => (
  <Flex direction="column" gap={8}>
    <Text size="2" weight="strong">
      {label}
    </Text>
    <LogViewer>{formatDecodedBody(body)}</LogViewer>
  </Flex>
);

let WebhookEventDetail = ({ event }: { event: WebhookTriggerEvent }) => (
  <Flex direction="column" gap={20}>
    <Datalist
      items={[
        {
          label: 'ID',
          value: (
            <Flex align="center" gap={6}>
              <MonoCode>{event.id}</MonoCode>
              <InlineCopy value={event.id} />
            </Flex>
          )
        },
        {
          label: 'Status',
          value: <Badge color={statusColors[event.status] || 'gray'}>{event.status}</Badge>
        },
        { label: 'Attempts', value: String(event.attemptCount) },
        { label: 'Method', value: event.request?.method ?? '-' },
        {
          label: 'URL',
          value: event.request?.url ? (
            <Flex align="center" gap={6}>
              <MonoCode>{event.request.url}</MonoCode>
              <InlineCopy value={event.request.url} />
            </Flex>
          ) : (
            '-'
          )
        },
        {
          label: 'Response status',
          value: event.slateResponse?.status != null ? String(event.slateResponse.status) : '-'
        },
        { label: 'Created', value: <RenderDate date={event.createdAt} /> },
        { label: 'Updated', value: <RenderDate date={event.updatedAt} /> }
      ]}
    />

    <Flex direction="column" gap={8}>
      <Text size="2" weight="strong">
        Request headers
      </Text>
      <LogViewer>{formatJsonValue(event.request?.headers ?? null)}</LogViewer>
    </Flex>

    <DecodedBodyBlock label="Request body" body={event.request?.body} />

    <Flex direction="column" gap={8}>
      <Text size="2" weight="strong">
        Response headers
      </Text>
      <LogViewer>{formatJsonValue(event.slateResponse?.headers ?? null)}</LogViewer>
    </Flex>

    <DecodedBodyBlock label="Response body" body={event.slateResponse?.body} />

    {event.responseOverride ? (
      <Flex direction="column" gap={8}>
        <Text size="2" weight="strong">
          Response override
        </Text>
        <LogViewer>{formatJsonValue(event.responseOverride)}</LogViewer>
      </Flex>
    ) : null}
  </Flex>
);

let showWebhookEventPanel = (event: WebhookTriggerEvent) => {
  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={900}>
      <Panel.Header>
        <Panel.Title>Webhook Event</Panel.Title>
        <Panel.Description>{event.id}</Panel.Description>
      </Panel.Header>
      <Panel.Content>
        <WebhookEventDetail event={event} />
      </Panel.Content>
    </Panel.Wrapper>
  ));
};

export let WebhookTriggerDetail = () => {
  let { webhookRegistrationId } = useParams<{ webhookRegistrationId: string }>();
  let trigger = useWebhookTrigger(webhookRegistrationId);
  let events = useWebhookTriggerEvents(webhookRegistrationId);
  let sendEvent = trigger.useSendEventMutator();

  return renderWithLoader({ trigger })(({ trigger: loaded }) => (
    <WebhookTriggerDetailContent
      trigger={loaded.data}
      sendEvent={sendEvent}
      onSent={events.refetch}
    />
  ));
};

let WebhookTriggerDetailContent = ({
  trigger,
  sendEvent,
  onSent
}: {
  trigger: NonNullable<ReturnType<typeof useWebhookTrigger>['data']>;
  sendEvent: ReturnType<ReturnType<typeof useWebhookTrigger>['useSendEventMutator']>;
  onSent: () => void;
}) => {
  let [method, setMethod] = useState<(typeof HTTP_METHODS)[number]>('POST');
  let [path, setPath] = useState('');
  let [urlMode, setUrlMode] = useState<'localhost' | 'configured'>('localhost');
  let [headersText, setHeadersText] = useState('{\n  "content-type": "application/json"\n}');
  let [bodyText, setBodyText] = useState('{}');
  let [formError, setFormError] = useState<string | null>(null);
  let [lastResult, setLastResult] = useState<unknown>(null);

  let submit = async () => {
    setFormError(null);

    let headers: Record<string, string>;
    try {
      let parsed: unknown = headersText.trim() ? JSON.parse(headersText) : {};
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setFormError('Headers must be a JSON object.');
        return;
      }
      headers = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value)
        ])
      );
    } catch {
      setFormError('Headers must be valid JSON.');
      return;
    }

    let [res] = await sendEvent.mutate({
      method,
      path: path.trim() || undefined,
      headers,
      body: bodyText,
      useLocalhostUrl: urlMode === 'localhost'
    });

    if (res) {
      setLastResult(res);
      onSent();
    }
  };

  return (
    <Flex direction="column" gap={24}>
      <BackLink to="/dev/webhook-triggers">Back to Webhook Triggers</BackLink>

      <Flex align="center" gap={12} style={{ flexWrap: 'wrap' }}>
        <Title size="6" weight="strong">
          {trigger.name}
        </Title>
        <Badge color={statusColors[trigger.status] || 'gray'}>{trigger.status}</Badge>
        <Badge color="gray">{trigger.type}</Badge>
        <Badge color="gray">{trigger.owner}</Badge>
      </Flex>

      <Group.Wrapper>
        <Group.Content>
          <Datalist
            items={[
              {
                label: 'ID',
                value: (
                  <Flex align="center" gap={6}>
                    <MonoCode>{trigger.id}</MonoCode>
                    <InlineCopy value={trigger.id} />
                  </Flex>
                )
              },
              {
                label: 'Tenant',
                value: trigger.tenant
                  ? `${trigger.tenant.name} (${trigger.tenant.identifier})`
                  : 'Global'
              },
              {
                label: 'Slate',
                value: (
                  <Link to={`/slates/${trigger.slate.id}`}>
                    {trigger.slate.name || trigger.slate.identifier}
                  </Link>
                )
              },
              {
                label: 'Trigger group',
                value: `${trigger.triggerGroup.name} (${trigger.triggerGroup.key})`
              },
              ...(trigger.webhookTarget
                ? [
                    {
                      label: 'Webhook target',
                      value: `${trigger.webhookTarget.name} (${trigger.webhookTarget.targetIdentifier})`
                    }
                  ]
                : []),
              {
                label: 'Receive URL',
                value: (
                  <Flex align="center" gap={6}>
                    <MonoCode>{trigger.receiveUrl}</MonoCode>
                    <InlineCopy value={trigger.receiveUrl} />
                  </Flex>
                )
              },
              {
                label: 'Localhost URL',
                value: (
                  <Flex align="center" gap={6}>
                    <MonoCode>{trigger.localhostReceiveUrl}</MonoCode>
                    <InlineCopy value={trigger.localhostReceiveUrl} />
                  </Flex>
                )
              },
              { label: 'Created', value: <RenderDate date={trigger.createdAt} /> }
            ]}
          />
        </Group.Content>
      </Group.Wrapper>

      <Group.Wrapper>
        <Group.Header title="Send Test Event" />
        <Group.Content>
          <Flex direction="column" gap={16}>
            <Text size="2" color="gray600">
              Sends a request through the same ingest path as a real webhook: create the event,
              enqueue processing, and wait for the slate to handle it.
            </Text>

            <Select
              label="HTTP Method"
              value={method}
              onChange={value => setMethod(value as (typeof HTTP_METHODS)[number])}
              items={HTTP_METHODS.map(item => ({ id: item, label: item }))}
            />

            <Select
              label="Request URL"
              value={urlMode}
              onChange={value => setUrlMode(value as 'localhost' | 'configured')}
              items={[
                { id: 'localhost', label: 'Localhost URL' },
                { id: 'configured', label: 'Configured Receive URL' }
              ]}
            />

            <Input
              label="Extra path"
              placeholder="/optional/suffix?query=1"
              value={path}
              onInput={setPath}
            />

            <Input
              label="Headers (JSON)"
              as="textarea"
              minRows={4}
              value={headersText}
              onInput={setHeadersText}
            />

            <Input
              label="Body"
              as="textarea"
              minRows={6}
              value={bodyText}
              onInput={setBodyText}
            />

            {formError && (
              <Text size="2" color="red600">
                {formError}
              </Text>
            )}

            <sendEvent.RenderError />

            <Flex>
              <Button
                loading={sendEvent.isLoading}
                success={sendEvent.isSuccess}
                onClick={submit}
              >
                Send Event
              </Button>
            </Flex>

            {lastResult ? (
              <Flex direction="column" gap={16}>
                <LogViewer>{JSON.stringify(lastResult, null, 2)}</LogViewer>
                <Flex direction="column" gap={8}>
                  <Text size="2" weight="strong">
                    Request body
                  </Text>
                  <LogViewer>
                    {formatDecodedBody(getResultBody(lastResult, 'request'))}
                  </LogViewer>
                </Flex>
                <Flex direction="column" gap={8}>
                  <Text size="2" weight="strong">
                    Response body
                  </Text>
                  <LogViewer>
                    {formatDecodedBody(getResultBody(lastResult, 'slateResponse'))}
                  </LogViewer>
                </Flex>
              </Flex>
            ) : null}
          </Flex>
        </Group.Content>
      </Group.Wrapper>

      <WebhookTriggerEventsSection webhookRegistrationId={trigger.id} />
    </Flex>
  );
};

let WebhookTriggerEventsSection = ({
  webhookRegistrationId
}: {
  webhookRegistrationId: string;
}) => {
  let events = useWebhookTriggerEvents(webhookRegistrationId);

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No webhook events found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        Events received or sent against this registration will show up here, most recent first.
      </Text>
    </EmptyState>
  );

  return (
    <Group.Wrapper>
      <Group.Header title="Recent Events" />
      <Group.Content>
        {renderWithPagination(events, { emptyState })(({ data }) => {
          let items = data.items;

          if (items.length === 0) return emptyState;

          return (
            <Table
              padding={{ sides: '20px' }}
              headers={['Status', 'Method', 'Attempts', 'Time']}
              data={items.map(event => ({
                onClick: () => showWebhookEventPanel(event),
                data: [
                  <Badge color={statusColors[event.status] || 'gray'}>{event.status}</Badge>,
                  <MonoCode>{event.request?.method ?? '-'}</MonoCode>,
                  <Text size="2">{event.attemptCount}</Text>,
                  <RenderDate date={event.createdAt} />
                ]
              }))}
            />
          );
        })}
      </Group.Content>
    </Group.Wrapper>
  );
};
