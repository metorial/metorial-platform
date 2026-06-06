import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
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
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderConfigVaultLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  let location = useLocation();
  let pathname = location.pathname;

  let vaultPathParams = [
    organization.data,
    project.data,
    instance.data,
    vault.data?.id ?? providerConfigVaultId
  ] as const;
  let overviewPath = Paths.instance.providerConfigVault(...vaultPathParams);
  let configsPath = Paths.instance.providerConfigVault(...vaultPathParams, 'configs');
  let settingsPath = Paths.instance.providerConfigVault(...vaultPathParams, 'settings');

  return (
    <ContentLayout>
      <PageHeader
        title={vault.data?.name ?? '...'}
        description={vault.data?.description ?? undefined}
        pagination={[
          {
            label: 'Configurations',
            href: Paths.instance.providerConfigVaults(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: vault.data?.name ?? '...',
            href: overviewPath
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ vault })(() => (
          <>
            <DeletedRecordCallout status={vault.data?.status} />

            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: overviewPath
                },
                {
                  label: 'Configs',
                  to: configsPath
                },
                {
                  label: 'Settings',
                  to: settingsPath
                }
              ]}
            />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
