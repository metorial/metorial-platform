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

export let ProviderAuthCredentialLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let deployment = useProviderDeployment(instance.data?.instanceId, providerDeploymentId);
  let credential = useProviderAuthCredential(
    instance.data?.instanceId,
    providerDeploymentId,
    providerAuthCredentialsId
  );

  let pathname = useLocation().pathname;

  let credentialPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId,
    credential.data?.id ?? providerAuthCredentialsId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={credential.data?.name ?? '...'}
        description={credential.data?.description ?? undefined}
        pagination={[
          {
            label: 'Configurations',
            href: Paths.instance.providerDeployments(
              organization.data,
              project.data,
              instance.data,
              'auth-configs'
            )
          },
          {
            label: deployment.data?.name ?? '...',
            href: Paths.instance.providerDeployment(
              organization.data,
              project.data,
              instance.data,
              deployment.data?.id ?? providerDeploymentId
            )
          },
          {
            label: credential.data?.name ?? '...',
            href: Paths.instance.providerAuthCredential(...credentialPathParams)
          }
        ]}
      />

      {renderWithLoader({ credential })(({ credential }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerAuthCredential(...credentialPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerAuthCredential(...credentialPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
