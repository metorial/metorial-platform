import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpServerSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServer
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiFlashlightLine } from '@remixicon/react';
import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { OpenExplorerButton, type OpenExplorerMode } from '../../../components/openExplorer';

export let MagicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let createSession = useCreateMagicMcpServerSession();
  let [isCreatingSession, setIsCreatingSession] = useState(false);

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? magicMcpServerId
  ] as const;

  let handleOpenExplorer = async (mode: OpenExplorerMode) => {
    if (isCreatingSession || !instance.data || !magicMcpServerId) return;
    setIsCreatingSession(true);
    let [res] = await createSession.mutate({ instanceId: instance.data.id, magicMcpServerId });
    setIsCreatingSession(false);
    if (res) {
      navigate(
        Paths.instance.explorer(organization.data, project.data, instance.data, {
          session_id: res.id,
          mode
        }),
        { state: { magicMcpServerId: server.data?.id ?? magicMcpServerId } }
      );
    }
  };

  return (
    <DetailsLayout
      entity={server.data}
      icon={<RiFlashlightLine />}
      breadcrumbs={[
        {
          label: 'Magic MCP Servers',
          to: Paths.instance.magicMcp.servers(organization.data, project.data, instance.data)
        },
        {
          label: server.data?.name,
          to: Paths.instance.magicMcp.server(...serverPathParams)
        }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.magicMcp.server(...serverPathParams) },
        { label: 'Settings', to: Paths.instance.magicMcp.server(...serverPathParams, 'config') }
      ]}
      actions={[
        {
          type: 'custom',
          render: () => (
            <OpenExplorerButton
              size="2"
              variant="outline"
              onOpen={handleOpenExplorer}
              loading={isCreatingSession}
            />
          )
        }
      ]}
      attributes={
        server.data
          ? [
              { label: 'ID', value: <ID id={server.data.id} /> },
              {
                label: 'Server Identifier',
                value: <ID id={server.data.endpoints[0]?.alias ?? '...'} />
              },
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
