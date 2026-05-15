import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SkillMarketplaceLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillMarketplaceId } = useParams();
  let marketplace = useSkillMarketplace(instance.data?.id, skillMarketplaceId);
  let pathname = useLocation().pathname;

  let marketplacePathParams = [
    organization.data,
    project.data,
    instance.data,
    marketplace.data?.id ?? skillMarketplaceId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={marketplace.data?.name ?? '...'}
        description={marketplace.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skill Marketplaces',
            href: Paths.instance.skillMarketplaces(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: marketplace.data?.name ?? '...',
            href: Paths.instance.skillMarketplace(...marketplacePathParams)
          }
        ]}
      />

      {renderWithLoader({ marketplace })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.skillMarketplace(...marketplacePathParams)
              },
              {
                label: 'Preview',
                to: Paths.instance.skillMarketplace(...marketplacePathParams, 'editor')
              },
              {
                label: 'Settings',
                to: Paths.instance.skillMarketplace(...marketplacePathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
