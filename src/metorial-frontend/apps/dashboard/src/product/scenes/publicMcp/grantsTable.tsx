import type { DashboardInstancePublicMcpServersGrantsListOutput } from '@metorial/dashboard-sdk';
import { usePublicMcpServerGrants, useRevokePublicMcpServerGrant } from '@metorial/state';
import {
  getConstrainedEnumListFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { confirm, RenderDate, Text, toast } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiCloseCircleLine } from '@remixicon/react';
import { getRevokedReasonLabel, PublicMcpGrantStatusBadge } from './shared';

type PublicMcpGrantRow = DashboardInstancePublicMcpServersGrantsListOutput['items'][number];

type PublicMcpGrantsTableProps = {
  instanceId: string;
  publicMcpServerId: string;
};

let usePublicMcpGrantsTableState: TableStateProvider<
  PublicMcpGrantsTableProps,
  PublicMcpGrantRow,
  TableStateProviderResult<PublicMcpGrantRow>
> = (props, opts) => {
  let grants = usePublicMcpServerGrants(props.instanceId, props.publicMcpServerId, {
    order: 'desc',
    status: getConstrainedEnumListFilterValue(
      opts.filter.status,
      ['pending_exchange', 'active', 'revoked', 'expired'],
      undefined
    )
  });

  return {
    isLoading: grants.isLoading,
    error: grants.error,
    hasMoreAfter: grants.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: grants.data?.pagination.hasMoreBefore ?? false,
    items: grants.data?.items ?? [],
    loadNext: grants.next,
    loadPrevious: grants.previous
  };
};

let publicMcpGrantsTable = new DashboardTable<PublicMcpGrantsTableProps, PublicMcpGrantRow>(
  'public-mcp-server-grants'
)
  .state(usePublicMcpGrantsTableState)
  .hookState((_, input) => {
    let revokeGrant = useRevokePublicMcpServerGrant();

    return {
      revokeGrant: async (grant: PublicMcpGrantRow) => {
        let [res] = await revokeGrant.mutate({
          instanceId: input.instanceId,
          publicMcpServerId: input.publicMcpServerId,
          publicMcpServerGrantId: grant.id
        });

        if (res) toast.success('Access revoked');
      }
    };
  })
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: grant => (
        <div>
          <PublicMcpGrantStatusBadge status={grant.status} />
          {getRevokedReasonLabel(grant.revokedReason) && (
            <Text size="1" color="gray600">
              {getRevokedReasonLabel(grant.revokedReason)}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'client',
      isDefault: true,
      header: 'Client',
      render: grant => (
        <div>
          <Text size="2" weight="strong">
            {grant.client.name}
          </Text>
          {grant.client.clientUri && (
            <Text size="1" color="gray600">
              {grant.client.clientUri}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'lastUsedAt',
      isDefault: true,
      header: 'Last Used',
      render: grant =>
        grant.lastUsedAt ? (
          <RenderDate date={grant.lastUsedAt} />
        ) : (
          <Text size="2" color="gray600">
            Never
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Connected',
      render: grant => <RenderDate date={grant.createdAt} />
    },
    {
      id: 'expiresAt',
      isDefault: false,
      header: 'Expires',
      render: grant => <RenderDate date={grant.expiresAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Grant ID',
      render: grant => <ID id={grant.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'pending_exchange', label: 'Pending' },
        { id: 'revoked', label: 'Revoked' },
        { id: 'expired', label: 'Expired' }
      ]
    }
  ])
  .actions({
    revoke: async (rows, state) => {
      let grant = rows[0];
      if (!grant) return;

      confirm({
        title: 'Revoke Access',
        description: `${grant.client.name} loses access immediately. The user has to sign in again to reconnect.`,
        confirmText: 'Revoke',
        onConfirm: () => state.revokeGrant(grant)
      });
    }
  })
  .rowActions([
    {
      id: 'revoke',
      label: 'Revoke Access',
      icon: <RiCloseCircleLine />,
      disabled: grant => grant.status !== 'active' && grant.status !== 'pending_exchange',
      action: 'revoke'
    }
  ])
  .build();

export let PublicMcpGrantsTable = (props: PublicMcpGrantsTableProps) =>
  publicMcpGrantsTable({
    ...props,
    emptyState: 'No one has connected to this server yet.'
  });
