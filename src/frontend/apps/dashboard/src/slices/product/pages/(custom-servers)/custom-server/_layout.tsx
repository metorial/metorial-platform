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
import { showCustomServerRemoteFormModal } from '../../../scenes/customServer/modal';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { showMagicMcpServerFormModal } from '../../../scenes/serverDeployments/modal';

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
  let hasCodeManagement = Boolean(
    customServer.data &&
      !customServer.data.draft?.remoteMcpServer &&
      !customServer.data.draft?.containerImage
  );

  return (
    <ContentLayout>
      <PageHeader
        title={customServer.data?.name ?? '...'}
        pagination={[
          {
            label:
              customServer.data?.status == 'active'
                ? 'External Providers'
                : 'Custom Providers',
            href:
              customServer.data?.status == 'active'
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
          <DeployServerButton providerId={customServer.data?.provider?.id}>
            Deploy Provider
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

              ...(hasCodeManagement
                ? [
                    {
                      label: 'Code',
                      to: Paths.instance.customServer(...pathParams, 'code')
                    },
                    {
                      label: 'Versions',
                      to: Paths.instance.customServer(...pathParams, 'versions')
                    }
                  ]
                : []),
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
                This provider is archived. It cannot be used for new connections.
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
  providerId,
  disabled
}: {
  children: React.ReactNode;
  providerId: string | undefined;
  disabled?: boolean;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let flags = useDashboardFlags();
  let isDisabled = disabled || !providerId;

  return !isDisabled &&
    (flags.data?.flags['magic-mcp-enabled'] ||
      (flags.data?.flags['managed-servers-enabled'] &&
        false)) ? (
    <Menu
      items={[
        {
          id: 'server-deployment',
          label: 'Provider Deployment',
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
        false
          ? [
              {
                id: 'fork-server',
                label: 'Fork Provider',
                description: 'Create a copy of this provider and edit the code.'
              }
            ]
          : [])
      ]}
      onItemClick={item => {
        if (item === 'server-deployment') {
          if (!instance.data) return;
          showProviderDeploymentFormModal({
            type: 'create',
            instanceId: instance.data.id,
            providerId,
            onCreate: deployment =>
              navigate(
                Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  deployment.id
                )
              )
          });
        } else if (item === 'magic-mcp-server') {
          showMagicMcpServerFormModal({
            type: 'create',
            for: { serverId: providerId! }
          });
        } else if (item === 'fork-server') {
          showCustomServerRemoteFormModal({
            type: 'managed'
          });
        }
      }}
    >
      <Button size="2">{children}</Button>
    </Menu>
  ) : (
    <Button
      disabled={isDisabled}
      size="2"
      onClick={() =>
        instance.data &&
        showProviderDeploymentFormModal({
          type: 'create',
          instanceId: instance.data.id,
          providerId,
          onCreate: deployment =>
            navigate(
              Paths.instance.providerDeployment(
                organization.data,
                project.data,
                instance.data,
                deployment.id
              )
            )
        })
      }
    >
      {children}
    </Button>
  );
};
