import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConnection
} from '@metorial/state';
import { Callout, LinkTabs, Spacer } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderConnectionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConnectionId } = useParams();
  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);

  let pathname = useLocation().pathname;

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    providerConnection.data?.id ?? providerConnectionId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={providerConnection.data?.name ?? '...'}
        pagination={[
          {
            label: 'OAuth Connections',
            href: Paths.instance.providerConnections(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: providerConnection.data?.name,
            href: Paths.instance.providerConnection(...pathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.providerConnection(...pathParams)
          },
          {
            label: 'Logs',
            to: Paths.instance.providerConnection(...pathParams, 'logs')
          },
          {
            label: 'Profiles',
            to: Paths.instance.providerConnection(...pathParams, 'profiles')
          },
          {
            label: 'Settings',
            to: Paths.instance.providerConnection(...pathParams, 'settings')
          }
        ]}
      />

      {providerConnection.data?.status == 'archived' && (
        <>
          <Callout color="orange">
            This OAuth connection is archived, it cannot be used to authenticate anymore.
          </Callout>

          <Spacer height={15} />
        </>
      )}

      {renderWithLoader({ providerConnection })(({ providerConnection }) => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
