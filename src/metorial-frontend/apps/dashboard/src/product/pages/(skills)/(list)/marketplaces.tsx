import { Paths } from '@metorial/frontend-config';
import { ContentLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplaces
} from '@metorial/state';
import { Navigate } from 'react-router-dom';
import { SkillMarketplacesEmptyState } from '../../../scenes/skills/marketplaceGrid';

export let SkillMarketplacesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let marketplaces = useSkillMarketplaces(instance.data?.id, {
    limit: 1,
    order: 'asc',
    status: ['active']
  });

  let defaultMarketplace = marketplaces.data?.items[0];

  if (defaultMarketplace) {
    return (
      <Navigate
        to={Paths.instance.skillMarketplace(
          organization.data,
          project.data,
          instance.data,
          defaultMarketplace.id
        )}
        replace
      />
    );
  }

  if (!marketplaces.data) return null;

  return (
    <ContentLayout>
      <SkillMarketplacesEmptyState />
    </ContentLayout>
  );
};
