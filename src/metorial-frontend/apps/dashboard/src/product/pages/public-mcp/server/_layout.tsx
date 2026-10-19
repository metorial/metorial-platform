import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePublicMcpServer
} from '@metorial/state';
import { confirm, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiGlobalLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { PublicMcpServerStatusBadge } from '../../../scenes/publicMcp/shared';

export let PublicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { publicMcpServerId } = useParams();
  let server = usePublicMcpServer(instance.data?.id, publicMcpServerId);
  let updateServer = server.useUpdateMutator();

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? publicMcpServerId
  ] as const;

  let status = server.data?.status;

  return (
    <DetailsLayout
      entity={server.data}
      icon={<RiGlobalLine />}
      breadcrumbs={[
        {
          label: 'Public MCP Servers',
          to: Paths.instance.publicMcp.servers(organization.data, project.data, instance.data)
        },
        {
          label: server.data?.name,
          to: Paths.instance.publicMcp.server(...serverPathParams)
        }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.publicMcp.server(...serverPathParams) },
        {
          label: 'Access',
          to: Paths.instance.publicMcp.server(...serverPathParams, 'access')
        },
        {
          label: 'Clients',
          to: Paths.instance.publicMcp.server(...serverPathParams, 'clients')
        },
        {
          label: 'Settings',
          to: Paths.instance.publicMcp.server(...serverPathParams, 'settings')
        }
      ]}
      actions={
        status == 'active'
          ? [
              {
                label: 'Disable',
                size: '2',
                variant: 'outline',
                loading: updateServer.isLoading,
                success: updateServer.isSuccess,
                onClick: () =>
                  confirm({
                    title: 'Disable Public MCP Server',
                    description:
                      'Connected clients stop working until you enable the server again. Existing access is kept.',
                    confirmText: 'Disable',
                    onConfirm: () => updateServer.mutate({ status: 'disabled' })
                  })
              }
            ]
          : status == 'disabled'
            ? [
                {
                  label: 'Enable',
                  size: '2',
                  loading: updateServer.isLoading,
                  success: updateServer.isSuccess,
                  onClick: () => updateServer.mutate({ status: 'active' })
                }
              ]
            : []
      }
      attributes={
        server.data
          ? [
              { label: 'ID', value: <ID id={server.data.id} /> },
              {
                label: 'Status',
                value: <PublicMcpServerStatusBadge status={server.data.status} />
              },
              { label: 'Slug', value: <ID id={server.data.slug} /> },
              { label: 'Deployment', value: <ID id={server.data.deployment.id} /> },
              { label: 'Created', value: <RenderDate date={server.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ server })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
