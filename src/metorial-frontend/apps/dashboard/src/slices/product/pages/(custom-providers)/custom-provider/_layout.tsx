import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider
} from '@metorial/state';
import { Button, Callout, LinkTabs, Spacer } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { isCustomProviderScmBacked } from '../../../scenes/customProvider/utils';
import { UseProviderButton } from '../../../scenes/providers/useProviderButton';

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
  let isArchived = customProvider.data?.status === 'archived';
  let isScmBackedProvider = isCustomProviderScmBacked(customProvider.data);
  let hasCodeManagement = Boolean(
    customProvider.data &&
    !isExternalProvider &&
    !customProvider.data.draft?.containerImage &&
    !isScmBackedProvider
  );
  let hasVersionManagement = Boolean(customProvider.data);

  return (
    <ContentLayout>
      <PageHeader
        title={customProvider.data?.name ?? '...'}
        pagination={[
          {
            label: isExternalProvider ? 'Remote MCP Servers' : 'Custom MCP Servers',
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

            <UseProviderButton
              providerId={customProvider.data?.provider?.id}
              disabled={isArchived}
            />
          </>
        }
      />

      <InitialLoadBoundary>
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
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
