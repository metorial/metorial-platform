import { DashboardInstanceMagicMcpSessionsListQuery } from '@metorial/dashboard-sdk';
import { col, createDataList, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useMagicMcpSessions } from '@metorial/state';
import type { ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';

let MagicMcpSessionsList = createDataList<DashboardInstanceMagicMcpSessionsListQuery>(
  'magic-mcp-sessions'
)
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useMagicMcpSessions(
      ctx.instanceId,
      withDefaults(
        { order: props.order ?? 'desc', magicMcpServerId: props.magicMcpServerId },
        { limit }
      )
    )
  )
  .columns([
    col.name({
      id: 'server',
      header: 'Server',
      get: row => row.magicMcpServer?.name,
      description: row => row.magicMcpServer?.description,
      fallback: 'Unnamed Server'
    }),
    col.text({
      id: 'endpoint',
      header: 'Endpoint',
      get: row => row.magicMcpServer?.endpoints[0]?.alias,
      fallback: 'No endpoint alias'
    }),
    col.createdAt(),
    col.updatedAt({ isDefault: true }),
    col.refId('sessionId', row => row.sessionId, { header: 'Session ID' }),
    col.refId('serverId', row => row.magicMcpServer?.id, { header: 'Server ID' }),
    col.id({ header: 'Magic MCP Session ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.magicMcp.connection(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let MagicMcpSessionsTable = (props: ComponentProps<typeof MagicMcpSessionsList>) => (
  <MagicMcpSessionsList emptyState="No Magic MCP sessions found." {...props} />
);
