import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthCredential
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderAuthCredentialLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);

  let pathname = useLocation().pathname;

  let credentialPathParams = [
    organization.data,
    project.data,
    instance.data,
    credential.data?.id ?? providerAuthCredentialsId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={credential.data?.name ?? '...'}
        description={credential.data?.description ?? undefined}
        pagination={[
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
                label: 'Auth Configs',
                to: Paths.instance.providerAuthCredential(
                  ...credentialPathParams,
                  'auth-configs'
                )
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
