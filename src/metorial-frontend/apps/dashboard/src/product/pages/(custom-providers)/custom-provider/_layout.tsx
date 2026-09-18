import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider
} from '@metorial/state';
import { Badge, Button, Callout, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiServerLine } from '@remixicon/react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { isCustomProviderScmBacked } from '../../../scenes/customProvider/utils';
import { UseProviderButton } from '../../../scenes/providers/useProviderButton';

export let CustomProviderLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

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
    <DetailsLayout
      entity={customProvider.data}
      icon={<RiServerLine />}
      breadcrumbs={[
        {
          label: isExternalProvider ? 'Remote MCP Servers' : 'Custom MCP Servers',
          to: isExternalProvider
            ? Paths.instance.externalProviders(organization.data, project.data, instance.data)
            : Paths.instance.customProviders(organization.data, project.data, instance.data)
        },
        { label: customProvider.data?.name, to: Paths.instance.customProvider(...pathParams) }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.customProvider(...pathParams) },
        ...(hasCodeManagement
          ? [{ label: 'Code', to: Paths.instance.customProvider(...pathParams, 'code') }]
          : []),
        ...(hasVersionManagement
          ? [{ label: 'Versions', to: Paths.instance.customProvider(...pathParams, 'versions') }]
          : []),
        { label: 'Settings', to: Paths.instance.customProvider(...pathParams, 'settings') }
      ]}
      actions={[
        ...(customProvider.data?.provider?.id
          ? [
              {
                type: 'custom' as const,
                render: () => (
                  <Link
                    to={Paths.instance.provider(
                      organization.data,
                      project.data,
                      instance.data,
                      customProvider.data!.provider!.slug
                    )}
                  >
                    <Button as="span" size="2" variant="outline">
                      Open Listing
                    </Button>
                  </Link>
                )
              }
            ]
          : []),
        {
          type: 'custom',
          render: () => (
            <UseProviderButton
              providerId={customProvider.data?.provider?.id}
              disabled={isArchived}
            />
          )
        }
      ]}
      attributes={
        customProvider.data
          ? [
              { label: 'ID', value: <ID id={customProvider.data.id} /> },
              { label: 'Status', value: <Badge color="gray">{customProvider.data.status}</Badge> },
              { label: 'Type', value: customProvider.data.type },
              ...(customProvider.data.provider?.id
                ? [
                    {
                      label: 'Provider ID',
                      value: <ID id={customProvider.data.provider.id} />
                    }
                  ]
                : [])
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ customProvider })(({ customProvider }) => (
          <>
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
    </DetailsLayout>
  );
};
