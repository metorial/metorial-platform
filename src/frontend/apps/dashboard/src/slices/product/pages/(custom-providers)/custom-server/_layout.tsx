import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider,
  useDashboardFlags
} from '@metorial/state';
import { Button, Callout, LinkTabs, Menu, Spacer } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showCustomProviderRemoteFormModal } from '../../../scenes/customProvider/modal';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { showMagicMcpServerFormModal } from '../../../scenes/providerDeployments/modal_';

export let CustomProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);
  let location = useLocation();
  let pathname = location.pathname;
  let initialCategory = (
    location.state as { category?: 'custom' | 'external' } | null
  )?.category;
  let [providerCategory, setProviderCategory] = useState<'custom' | 'external' | undefined>(
    initialCategory
  );

  let navigate = useNavigate();
  useEffect(() => {
    if (!initialCategory || initialCategory === providerCategory) return;
    setProviderCategory(initialCategory);
  }, [initialCategory, providerCategory]);

  useEffect(() => {
    if (customServer.data && customServer.data.id != customServerId) {
      let nextPath = `${location.pathname.replace(customServerId!, customServer.data.id)}${location.search}${location.hash}`;
      navigate(
        nextPath,
        {
          replace: true,
          state: location.state
        }
      );
    }
  }, [
    customServer.data,
    customServerId,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate
  ]);

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    customServer.data?.id ?? customServerId
  ] as const;

  let flags = useDashboardFlags();
  let isExternalProvider =
    !!customServer.data?.draft?.remoteMcpServer || providerCategory === 'external';
  let hasCodeManagement = Boolean(
    customServer.data &&
      !isExternalProvider &&
      !customServer.data.draft?.containerImage
  );
  let hasVersionManagement = Boolean(customServer.data);

  return (
    <ContentLayout>
      <PageHeader
        title={customServer.data?.name ?? '...'}
        pagination={[
          {
            label: isExternalProvider ? 'External Providers' : 'Custom Providers',
            href: isExternalProvider
              ? Paths.instance.externalProviders(
                  organization.data,
                  project.data,
                  instance.data
                )
              : Paths.instance.customProviders(
                  organization.data,
                  project.data,
                  instance.data
                )
          },
          {
            label: customServer.data?.name,
            href: Paths.instance.customProvider(...pathParams)
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
                to: Paths.instance.customProvider(...pathParams)
              },

              ...(hasCodeManagement
                ? [
                    {
                      label: 'Code',
                      to: Paths.instance.customProvider(...pathParams, 'code')
                    }
                  ]
                : []),
              ...(hasVersionManagement
                ? [
                    {
                      label: 'Versions',
                      to: Paths.instance.customProvider(...pathParams, 'versions')
                    }
                  ]
                : []),
              {
                label: 'Commits',
                to: Paths.instance.customProvider(...pathParams, 'commits')
              },
              {
                label: 'Deployments',
                to: Paths.instance.customProvider(...pathParams, 'deployments')
              },

              ...(flags.data?.flags['community-profiles-enabled']
                ? [
                    {
                      label: 'Listing',
                      to: Paths.instance.customProvider(...pathParams, 'listing')
                    }
                  ]
                : []),

              {
                label: 'Settings',
                to: Paths.instance.customProvider(...pathParams, 'settings')
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
      (flags.data?.flags['managed-servers-enabled'] && false)) ? (
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
        ...(flags.data?.flags['managed-servers-enabled'] && false
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
          showCustomProviderRemoteFormModal({
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
