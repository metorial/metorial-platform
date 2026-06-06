import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
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
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderAuthCredentialLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);

  let location = useLocation();
  let pathname = location.pathname;

  let credentialPathParams = [
    organization.data,
    project.data,
    instance.data,
    credential.data?.id ?? providerAuthCredentialsId
  ] as const;
  let overviewPath = Paths.instance.providerAuthCredential(...credentialPathParams);
  let authConfigsPath = Paths.instance.providerAuthCredential(
    ...credentialPathParams,
    'auth-configs'
  );
  let settingsPath = Paths.instance.providerAuthCredential(
    ...credentialPathParams,
    'settings'
  );

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
            href: overviewPath
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ credential })(() => (
          <>
            <DeletedRecordCallout status={credential.data?.status} />

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
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
