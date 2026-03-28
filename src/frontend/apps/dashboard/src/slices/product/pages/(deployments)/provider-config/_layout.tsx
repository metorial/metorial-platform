import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfig
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);

  let pathname = useLocation().pathname;

  let configPathParams = [
    organization.data,
    project.data,
    instance.data,
    config.data?.id ?? providerConfigId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={config.data?.name ?? '...'}
        description={config.data?.description ?? undefined}
        pagination={[
          {
            label: 'Configs',
            href: Paths.instance.providerConfigs(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: config.data?.name ?? '...',
            href: Paths.instance.providerConfig(...configPathParams)
          }
        ]}
      />

      {renderWithLoader({ config })(({ config }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerConfig(...configPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerConfig(...configPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
