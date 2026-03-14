import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVault
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderConfigVaultLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  let pathname = useLocation().pathname;

  let vaultPathParams = [
    organization.data,
    project.data,
    instance.data,
    vault.data?.id ?? providerConfigVaultId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={vault.data?.name ?? '...'}
        description={vault.data?.description ?? undefined}
        pagination={[
          {
            label: 'Configurations',
            href: Paths.instance.providerDeployments(
              organization.data,
              project.data,
              instance.data,
              'config-vaults'
            )
          },
          ...(vault.data?.deployment
            ? [
                {
                  label: vault.data.deployment.name ?? 'Deployment',
                  href: Paths.instance.providerDeployment(
                    organization.data,
                    project.data,
                    instance.data,
                    vault.data.deployment.id
                  )
                }
              ]
            : []),
          {
            label: vault.data?.name ?? '...',
            href: Paths.instance.providerConfigVault(...vaultPathParams)
          }
        ]}
      />

      {renderWithLoader({ vault })(({ vault }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerConfigVault(...vaultPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerConfigVault(...vaultPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
