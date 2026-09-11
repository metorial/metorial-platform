import { Badge, Callout, Text, theme } from '@metorial/ui';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

export type CallbackSync = {
  status: 'pending' | 'synced' | 'failed';
  error: { code: string; message: string | null } | null;
  syncedAt: Date | null;
};

export let DashedLink = styled(Link)`
  color: ${theme.colors.gray900};
  text-decoration: underline dashed;
  text-decoration-color: ${theme.colors.gray500};
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  font-weight: 500;
  word-break: break-all;
  transition:
    color 120ms ease,
    text-decoration-color 120ms ease;

  &:hover {
    color: ${theme.colors.gray700};
    text-decoration-color: ${theme.colors.gray700};
  }
`;

export let Muted = ({ children }: { children?: React.ReactNode }) => (
  <Text size="2" color="gray600">
    {children ?? '-'}
  </Text>
);

let SYNC_LABELS: Record<CallbackSync['status'], string> = {
  pending: 'Registering',
  synced: 'Live',
  failed: 'Registration Failed'
};

export let getSyncColor = (status: CallbackSync['status']) => {
  if (status === 'synced') return 'blue';
  if (status === 'failed') return 'red';
  return 'orange';
};

export let CallbackSyncBadge = ({
  sync,
  size
}: {
  sync: CallbackSync;
  size?: '1' | '2' | '3';
}) => (
  <Badge size={size} color={getSyncColor(sync.status)}>
    {SYNC_LABELS[sync.status]}
  </Badge>
);

export let CallbackSyncErrorCallout = ({ sync }: { sync: CallbackSync }) => {
  if (sync.status !== 'failed' || !sync.error) return null;

  return (
    <Callout color="red">
      <span>
        <strong>Metorial could not register this callback with the provider.</strong>{' '}
        {sync.error.message ?? sync.error.code} — no events will be delivered until this is
        resolved.
      </span>
    </Callout>
  );
};

export let CallbackPendingCallout = ({ sync }: { sync: CallbackSync }) => {
  if (sync.status !== 'pending') return null;

  return (
    <Callout color="orange">
      <span>
        <strong>Registration in progress.</strong> Metorial is registering this callback with
        the provider. Events start arriving once registration completes.
      </span>
    </Callout>
  );
};

export let getCallbackEventStatusColor = (status: 'pending' | 'processed' | 'failed') => {
  if (status === 'processed') return 'blue';
  if (status === 'failed') return 'red';
  return 'orange';
};

export let getIncomingWebhookStatusColor = (status: string) => {
  if (status === 'succeeded') return 'blue';
  if (status === 'failed_final') return 'red';
  if (status === 'failed_retrying') return 'orange';
  return 'gray';
};

export let INCOMING_WEBHOOK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  failed_retrying: 'Retrying',
  failed_final: 'Failed',
  succeeded: 'Succeeded'
};

export let getIncomingWebhookStatusLabel = (status: string) =>
  INCOMING_WEBHOOK_STATUS_LABELS[status] ?? status;

export let INCOMING_WEBHOOK_ERROR_STATUSES = ['failed_retrying', 'failed_final'] as const;

export let getWebhookRegistrationStatusColor = (
  status: 'awaiting_setup' | 'active' | 'archived' | 'deleted'
) => {
  if (status === 'active') return 'blue';
  if (status === 'awaiting_setup') return 'orange';
  if (status === 'archived') return 'gray';
  return 'gray';
};

export let WEBHOOK_REGISTRATION_STATUS_LABELS: Record<string, string> = {
  awaiting_setup: 'Awaiting Setup',
  active: 'Active',
  archived: 'Archived',
  deleted: 'Deleted'
};

export let getStatusColor = (status: 'active' | 'archived' | 'deleted') => {
  if (status === 'active') return 'blue';
  if (status === 'archived') return 'orange';
  return 'gray';
};

export let decodeWebhookBody = (
  body: { encoding: 'base64'; content: string } | null | undefined
) => {
  if (!body) return null;

  try {
    let decoded = atob(body.content);
    try {
      return { json: JSON.parse(decoded) as unknown, text: decoded };
    } catch {
      return { json: null, text: decoded };
    }
  } catch {
    return { json: null, text: body.content };
  }
};
