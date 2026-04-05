import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthCredential,
  useProviderDeployment
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { getFromDeployment, withFromDeployment } from '../fromDeployment';

export let ProviderAuthCredentialLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);

  let location = useLocation();
  let pathname = location.pathname;
  let fromDeployment = getFromDeployment(location.search);
  let deployment = useProviderDeployment(instance.data?.id, fromDeployment);

  let credentialPathParams = [
    organization.data,
    project.data,
    instance.data,
    credential.data?.id ?? providerAuthCredentialsId
  ] as const;
  let deploymentPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? fromDeployment
  ] as const;
  let overviewPath = withFromDeployment(
    Paths.instance.providerAuthCredential(...credentialPathParams),
    fromDeployment
  );
  let authConfigsPath = withFromDeployment(
    Paths.instance.providerAuthCredential(...credentialPathParams, 'auth-configs'),
    fromDeployment
  );
  let settingsPath = withFromDeployment(
    Paths.instance.providerAuthCredential(...credentialPathParams, 'settings'),
    fromDeployment
  );

  return (
    <ContentLayout>
      <PageHeader
        title={credential.data?.name ?? '...'}
        description={credential.data?.description ?? undefined}
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
                  label: 'Auth Credentials',
                  href: withFromDeployment(
                    Paths.instance.providerDeployment(
                      ...deploymentPathParams,
                      'auth-credentials'
                    ),
                    fromDeployment
                  )
                },
                {
                  label: credential.data?.name ?? '...',
                  href: overviewPath
                }
              ]
            : [
                {
                  label: 'Auth Credentials',
                  href: Paths.instance.providerAuthCredentials(
                    organization.data,
                    project.data,
                    instance.data
                  )
                },
                {
                  label: credential.data?.name ?? '...',
                  href: overviewPath
                }
              ]
        }
      />

      {renderWithLoader({ credential })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: overviewPath
              },
              {
                label: 'Auth Configs',
                to: authConfigsPath
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
