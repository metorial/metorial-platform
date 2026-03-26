import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionConnection
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';

let ConnectionStatusBadge = ({ state }: { state: string }) => {
  return (
    <Badge
      color={
        {
          connected: 'blue' as const,
          disconnected: 'gray' as const
        }[state] ?? ('gray' as const)
      }
    >
      {{
        connected: 'Connected',
        disconnected: 'Disconnected'
      }[state] ?? state}
    </Badge>
  );
};

export let MagicMcpConnectionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { connectionId } = useParams();
  let connection = useSessionConnection(instance.data?.id, connectionId);

  return (
    <ContentLayout>
      <PageHeader
        title={connection.data?.participant?.name ?? 'Connection'}
        pagination={[
          {
            label: 'Connections',
            href: Paths.instance.magicMcp.connections(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: connection.data?.participant?.name ?? 'Connection',
            href: Paths.instance.magicMcp.connection(
              organization.data,
              project.data,
              instance.data,
              connection.data?.id ?? connectionId
            )
          }
        ]}
      />

      {renderWithLoader({ connection })(({ connection }) => (
        <AttributesLayout
          variant="large"
          items={[
            {
              label: 'Status',
              value: <ConnectionStatusBadge state={connection.data.connectionState} />
            },
            { label: 'Connection ID', value: <ID id={connection.data.id} /> },
            {
              label: 'MCP Client',
              value: connection.data.participant?.name ?? 'Unknown'
            },
            {
              label: 'Transport',
              value: connection.data.transport
            },
            ...(connection.data.mcp?.protocolVersion
              ? [
                  {
                    label: 'Protocol Version',
                    value: connection.data.mcp.protocolVersion
                  }
                ]
              : []),
            {
              label: 'Client Messages',
              value: connection.data.usage?.totalProductiveClientMessageCount ?? 0
            },
            {
              label: 'Provider Messages',
              value: connection.data.usage?.totalProductiveProviderMessageCount ?? 0
            },
            {
              label: 'Connected At',
              value: <RenderDate date={connection.data.createdAt} />
            },
            {
              label: 'Last Active',
              value: connection.data.lastActiveAt ? (
                <RenderDate date={connection.data.lastActiveAt} />
              ) : (
                'N/A'
              )
            }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
