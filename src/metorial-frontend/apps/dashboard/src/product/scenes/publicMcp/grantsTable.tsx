import type { DashboardInstancePublicMcpServersGrantsListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineAction,
  defineStatus,
  EmptyValue,
  f,
  StatusBadge,
  withDefaults
} from '@metorial/data-list';
import { usePublicMcpServerGrants, useRevokePublicMcpServerGrant } from '@metorial/state';
import { RenderDate, Text, toast } from '@metorial/ui';
import { RiCloseCircleLine } from '@remixicon/react';
import { useInstanceContext } from '../../lib/dataList';
import { getRevokedReasonLabel } from './shared';

type PublicMcpGrantRow = DashboardInstancePublicMcpServersGrantsListOutput['items'][number];

type PublicMcpGrantsTableProps = {
  instanceId: string;
  publicMcpServerId: string;
};

let grantStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  pending_exchange: { label: 'Pending', color: 'orange' },
  revoked: { label: 'Revoked', color: 'red' },
  expired: { label: 'Expired', color: 'gray' }
});

let PublicMcpGrantsList = createDataList<PublicMcpGrantsTableProps>('public-mcp-server-grants')
  .context(useInstanceContext)
  .filters(() => ({ status: f.status(grantStatus) }))
  .paginated(({ props, filters, limit }) =>
    usePublicMcpServerGrants(
      props.instanceId,
      props.publicMcpServerId,
      withDefaults({ order: 'desc' as const }, { ...filters, limit })
    )
  )
  .columns([
    col.custom({
      id: 'status',
      header: 'Status',
      render: row => (
        <div>
          <StatusBadge status={row.status} descriptor={grantStatus} />
          {getRevokedReasonLabel(row.revokedReason) && (
            <Text size="1" color="gray600">
              {getRevokedReasonLabel(row.revokedReason)}
            </Text>
          )}
        </div>
      )
    }),
    col.name({
      id: 'client',
      header: 'Client',
      get: row => row.client.name,
      description: row => row.client.clientUri
    }),
    col.custom({
      id: 'lastUsedAt',
      header: 'Last Used',
      render: row =>
        row.lastUsedAt ? <RenderDate date={row.lastUsedAt} /> : <EmptyValue>Never</EmptyValue>
    }),
    col.createdAt({ header: 'Connected' }),
    col.date('expiresAt', { header: 'Expires' }),
    col.id({ header: 'Grant ID' })
  ])
  .itemActions([
    defineAction<PublicMcpGrantRow, PublicMcpGrantsTableProps>({
      id: 'revoke',
      label: 'Revoke Access',
      icon: <RiCloseCircleLine />,
      destructive: true,
      disabled: row => row.status !== 'active' && row.status !== 'pending_exchange',
      confirm: {
        title: 'Revoke Access',
        confirmText: 'Revoke',
        description: rows =>
          `${rows[0]?.client.name} loses access immediately. The user has to sign in again to reconnect.`
      },
      useRun: ({ props }) => {
        let revokeGrant = useRevokePublicMcpServerGrant();

        return async row => {
          let [res, error] = await revokeGrant.mutate({
            instanceId: props.instanceId,
            publicMcpServerId: props.publicMcpServerId,
            publicMcpServerGrantId: row.id
          });

          if (error) throw error;
          if (res) toast.success('Access revoked');
        };
      }
    })
  ])
  .build();

export let PublicMcpGrantsTable = (props: PublicMcpGrantsTableProps) => (
  <PublicMcpGrantsList emptyState="No one has connected to this server yet." {...props} />
);
