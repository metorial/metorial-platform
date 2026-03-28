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
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  showMagicMcpServerFormModal,
  showProviderDeploymentFormModal
} from '../../../scenes/providerDeployments/modal';

export let CustomProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let location = useLocation();
  let pathname = location.pathname;

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    customProvider.data?.id ?? customProviderId
  ] as const;

  let isExternalProvider = customProvider.data?.type == 'remote';
  let hasCodeManagement = Boolean(
    customProvider.data && !isExternalProvider && !customProvider.data.draft?.containerImage
  );
  let hasVersionManagement = Boolean(customProvider.data);

  return (
    <ContentLayout>
      <PageHeader
        title={customProvider.data?.name ?? '...'}
        pagination={[
          {
            label: isExternalProvider ? 'External Providers' : 'Custom Providers',
            href: isExternalProvider
              ? Paths.instance.externalProviders(
                  organization.data,
                  project.data,
                  instance.data
                )
              : Paths.instance.customProviders(organization.data, project.data, instance.data)
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
          id: 'provider-deployment',
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
        if (item === 'provider-deployment') {
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
            for: { providerId }
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
