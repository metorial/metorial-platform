import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import {
  SkillMarketplacesEmptyState,
  SkillMarketplacesList
} from '../../../scenes/skills/marketplaceGrid';
import { showSkillMarketplaceFormModal } from '../../../scenes/skills/marketplaceModal';

export let SkillMarketplacesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skill Marketplaces"
        description="Marketplaces let you publish selected plugins and skills for your team."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSkillMarketplaceFormModal({
                instanceId: instance.data.id,
                onCreate: marketplace => {
                  navigate(
                    Paths.instance.skillMarketplace(
                      organization.data,
                      project.data,
                      instance.data,
                      marketplace.id
                    )
                  );
                }
              })
            }
          >
            Create Marketplace
          </Button>
        }
      />

      <SkillMarketplacesList emptyState={{ initial: () => <SkillMarketplacesEmptyState /> }} />
    </ContentLayout>
  ));
};
