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
import { showSkillGroupFormModal } from '../../../scenes/skills/groupModal';
import { SkillGroupsEmptyState, SkillGroupsList } from '../../../scenes/skills/groupGrid';

export let SkillGroupsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skill Groups"
        description="Groups let you organize related skills and manage them as a set."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSkillGroupFormModal({
                instanceId: instance.data.id,
                onCreate: skillGroup => {
                  navigate(
                    Paths.instance.skillGroup(
                      organization.data,
                      project.data,
                      instance.data,
                      skillGroup.id
                    )
                  );
                }
              })
            }
          >
            Create Group
          </Button>
        }
      />

      <SkillGroupsList emptyState={{ initial: () => <SkillGroupsEmptyState /> }} />
    </ContentLayout>
  ));
};
