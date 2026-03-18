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
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { showMagicMcpServerFormModal } from '../../../scenes/providerDeployments/modal_';

export let CustomProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  let navigate = useNavigate();
  useEffect(() => {
    if (customProvider.data && customProvider.data.id != customProviderId) {
      navigate(location.pathname.replace(customProviderId!, customProvider.data.id), {
        replace: true
      });
    }
  }, [customProvider.data, customProviderId]);

  let pathname = useLocation().pathname;

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    customProvider.data?.id ?? customProviderId
  ] as const;

  let flags = useDashboardFlags();
  let hasCodeManagement = Boolean(
    customProvider.data &&
      // !customProvider.data.draft?.remoteMcpProvider &&
      !customProvider.data.draft?.containerImage
  );

  return (
    <ContentLayout>
      <PageHeader
        title={customProvider.data?.name ?? '...'}
        pagination={[
          {
            label: 'Custom Providers',
            href: Paths.instance.customProviders(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: customProvider.data?.name,
            href: Paths.instance.customProvider(...pathParams)
          }
        ]}
        actions={
          <>
            {customProvider.data?.provider?.id && (
              <Link
                to={Paths.instance.provider(
                  organization.data,
                  project.data,
                  instance.data,
                  customProvider.data.provider.id
                )}
              >
                <Button as="span" size="2" variant="outline">
                  Open Listing
                </Button>
              </Link>
            )}
            <DeployServerButton providerId={customProvider.data?.provider?.id}>
              Deploy Provider
            </DeployServerButton>
          </>
        }
      />

      {renderWithLoader({ customProvider })(({ customProvider }) => (
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
                    },
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

              {
                label: 'Listing',
                to: Paths.instance.customProvider(...pathParams, 'listing')
              },

              {
                label: 'Settings',
                to: Paths.instance.customProvider(...pathParams, 'settings')
              }
            ]}
          />

          {customProvider.data?.status == 'archived' && (
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

  return !isDisabled && flags.data?.flags['magic-mcp-enabled'] ? (
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
