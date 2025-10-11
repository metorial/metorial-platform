import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomServer,
  useDashboardFlags
} from '@metorial/state';
import { Button, Callout, LinkTabs, Menu, Spacer } from '@metorial/ui';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
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

  return flags.data?.flags['magic-mcp-enabled'] ? (
    <Menu
      items={[
        {
          id: 'server-deployment',
          label: 'Server Deployment',
          description: 'More powerful and flexible.'
        },
        {
          id: 'magic-mcp-server',
          label: 'Magic MCP Server',
          description: 'Easier to use and manage.'
        }
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
