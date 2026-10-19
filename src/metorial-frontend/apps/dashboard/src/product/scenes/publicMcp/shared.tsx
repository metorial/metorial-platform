import type {
  DashboardInstancePublicMcpServersGetOutput,
  DashboardInstancePublicMcpServersGrantsGetOutput
} from '@metorial/dashboard-sdk';
import { Badge } from '@metorial/ui';

export type PublicMcpServer = DashboardInstancePublicMcpServersGetOutput;
export type PublicMcpServerGrant = DashboardInstancePublicMcpServersGrantsGetOutput;

let serverStatus: Record<
  PublicMcpServer['status'],
  { label: string; color: 'green' | 'orange' | 'gray' }
> = {
  active: { label: 'Active', color: 'green' },
  disabled: { label: 'Disabled', color: 'orange' },
  archived: { label: 'Archived', color: 'gray' },
  deleted: { label: 'Deleted', color: 'gray' }
};

export let PublicMcpServerStatusBadge = ({
  status
}: {
  status: PublicMcpServer['status'];
}) => (
  <Badge size="1" color={serverStatus[status].color}>
    {serverStatus[status].label}
  </Badge>
);

let grantStatus: Record<
  PublicMcpServerGrant['status'],
  { label: string; color: 'green' | 'orange' | 'gray' | 'red' }
> = {
  pending_exchange: { label: 'Pending', color: 'orange' },
  active: { label: 'Active', color: 'green' },
  revoked: { label: 'Revoked', color: 'red' },
  expired: { label: 'Expired', color: 'gray' }
};

export let PublicMcpGrantStatusBadge = ({
  status
}: {
  status: PublicMcpServerGrant['status'];
}) => (
  <Badge size="1" color={grantStatus[status].color}>
    {grantStatus[status].label}
  </Badge>
);

let revokedReasonLabels: Record<NonNullable<PublicMcpServerGrant['revokedReason']>, string> = {
  owner_revoked: 'Revoked by you',
  user_revoked: 'Revoked by the user',
  refresh_token_reuse: 'Refresh token reused',
  authorization_code_reuse: 'Authorization code reused',
  server_archived: 'Server archived',
  idle_expired: 'Expired after inactivity',
  exchange_expired: 'Authorization not completed'
};

export let getRevokedReasonLabel = (reason: PublicMcpServerGrant['revokedReason']) =>
  reason ? revokedReasonLabels[reason] : null;

export let isValidPublicMcpSlug = (slug: string) =>
  /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug) && !slug.includes('--');

export let slugifyPublicMcpName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');
