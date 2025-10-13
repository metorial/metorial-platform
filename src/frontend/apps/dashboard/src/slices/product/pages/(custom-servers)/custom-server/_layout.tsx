import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomServer,
  useDashboardFlags,
  useServerListing
} from '@metorial/state';
import { Button, Callout, LinkTabs, Menu, Spacer } from '@metorial/ui';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showCustomServerRemoteFormModal } from '../../../scenes/customServer/modal';
import {
  showMagicMcpServerFormModal,
  showServerDeploymentFormModal
} from '../../../scenes/serverDeployments/modal';

export let CustomServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let navigate = useNavigate();
  useEffect(() => {
    if (customServer.data && customServer.data.id != customServerId) {
      navigate(location.pathname.replace(customServerId!, customServer.data.id), {
        replace: true
      });
    }
  }, [customServer.data, customServerId]);

  let pathname = useLocation().pathname;

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    customServer.data?.id ?? customServerId
  ] as const;

  let flags = useDashboardFlags();

  return (
    <ContentLayout>
      <PageHeader
        title={customServer.data?.name ?? '...'}
        pagination={[
          {
            label:
              customServer.data?.type == 'remote' ? 'External Servers' : 'Managed Servers',
            href:
              customServer.data?.type == 'remote'
                ? Paths.instance.externalServers(
                    organization.data,
                    project.data,
                    instance.data
                  )
                : Paths.instance.managedServers(organization.data, project.data, instance.data)
          },
          {
            label: customServer.data?.name,
            href: Paths.instance.customServer(...pathParams)
          }
        ]}
        actions={
          <DeployServerButton serverId={customServer.data?.server.id!}>
            Deploy Server
          </DeployServerButton>
        }
      />

      {renderWithLoader({ customServer })(({ customServer }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.customServer(...pathParams)
              },

              ...(customServer.data?.type === 'managed'
                ? [
                    {
                      label: 'Code',
                      to: Paths.instance.customServer(...pathParams, 'code')
                    }
                  ]
                : []),

              {
                label: 'Versions',
                to: Paths.instance.customServer(...pathParams, 'versions')
              },
              {
                label: 'Deployments',
                to: Paths.instance.customServer(...pathParams, 'deployments')
              },

              ...(flags.data?.flags['community-profiles-enabled']
                ? [
                    {
                      label: 'Listing',
                      to: Paths.instance.customServer(...pathParams, 'listing')
                    }
                  ]
                : []),

              {
                label: 'Settings',
                to: Paths.instance.customServer(...pathParams, 'settings')
              }
            ]}
          />

          {customServer.data?.status == 'archived' && (
            <>
              <Callout color="orange">
                This custom server is archived. It cannot be used for new connections.
              </Callout>

              <Spacer height={15} />
            </>
          )}

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};

export let DeployServerButton = ({
  children,
  serverId,
  disabled
}: {
  children: React.ReactNode;
  serverId: string;
  disabled?: boolean;
}) => {
  let flags = useDashboardFlags();
  let instance = useCurrentInstance();
  let server = useServerListing(instance.data?.id, serverId);

  return flags.data?.flags['magic-mcp-enabled'] ||
    (flags.data?.flags['managed-servers-enabled'] && server.data?.fork.status == 'enabled') ? (
    <Menu
      items={[
        {
          id: 'server-deployment',
          label: 'Server Deployment',
          description: 'More powerful and flexible.'
        },
        ...(flags.data?.flags['magic-mcp-enabled']
          ? [
              {
                id: 'magic-mcp-server',
                label: 'Magic MCP Server',
                description: 'Easier to use and manage.'
              }
            ]
          : []),
        ...(flags.data?.flags['managed-servers-enabled'] &&
        server.data?.fork.status == 'enabled'
          ? [
              {
                id: 'fork-server',
                label: 'Fork Server',
                description: 'Create a copy of this server and edit the code.'
              }
            ]
          : [])
      ]}
      onItemClick={item => {
        if (item === 'server-deployment') {
          showServerDeploymentFormModal({
            type: 'create',
            for: { serverId }
          });
        } else if (item === 'magic-mcp-server') {
          showMagicMcpServerFormModal({
            type: 'create',
            for: { serverId }
          });
        } else if (item === 'fork-server' && server.data?.fork.status == 'enabled') {
          showCustomServerRemoteFormModal({
            type: 'managed',
            templateId: server.data.fork.templateId
          });
        }
      }}
    >
      <Button size="2" disabled={disabled}>
        {children}
      </Button>
    </Menu>
  ) : (
    <Button
      disabled={disabled}
      size="2"
      onClick={() =>
        showServerDeploymentFormModal({
          type: 'create',
          for: { serverId }
        })
      }
    >
      {children}
    </Button>
  );
};
