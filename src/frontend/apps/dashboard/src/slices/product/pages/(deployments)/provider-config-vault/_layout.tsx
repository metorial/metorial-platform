import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVault,
  useProviderDeployment
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { getFromDeployment, withFromDeployment } from '../fromDeployment';

export let ProviderConfigVaultLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  let location = useLocation();
  let pathname = location.pathname;
  let fromDeployment = getFromDeployment(location.search, vault.data?.deployment?.id);
  let deployment = useProviderDeployment(instance.data?.id, fromDeployment);

  let vaultPathParams = [
    organization.data,
    project.data,
    instance.data,
    vault.data?.id ?? providerConfigVaultId
  ] as const;
  let deploymentPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? fromDeployment
  ] as const;
  let overviewPath = withFromDeployment(
    Paths.instance.providerConfigVault(...vaultPathParams),
    fromDeployment
  );
  let configsPath = withFromDeployment(
    Paths.instance.providerConfigVault(...vaultPathParams, 'configs'),
    fromDeployment
  );
  let settingsPath = withFromDeployment(
    Paths.instance.providerConfigVault(...vaultPathParams, 'settings'),
    fromDeployment
  );

  return (
    <ContentLayout>
      <PageHeader
        title={vault.data?.name ?? '...'}
        description={vault.data?.description ?? undefined}
        pagination={
          fromDeployment
            ? [
                {
                  label: 'Deployments',
                  href: Paths.instance.providerDeployments(
                    organization.data,
                    project.data,
                    instance.data
                  )
                },
                {
                  label: deployment.data?.name ?? '...',
                  href: withFromDeployment(
                    Paths.instance.providerDeployment(...deploymentPathParams),
                    fromDeployment
                  )
                },
                {
                  label: 'Vaults',
                  href: withFromDeployment(
                    Paths.instance.providerDeployment(
                      ...deploymentPathParams,
                      'config-vaults'
                    ),
                    fromDeployment
                  )
                },
                {
                  label: vault.data?.name ?? '...',
                  href: overviewPath
                }
              ]
            : [
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
              ]
        }
      />

      {renderWithLoader({ vault })(() => (
        <>
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
    </ContentLayout>
  );
};
