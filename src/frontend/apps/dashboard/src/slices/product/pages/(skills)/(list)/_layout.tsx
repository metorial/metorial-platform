import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useNavigate } from 'react-router-dom';
import { showSkillFormModal } from '../../../scenes/skills/modal';

export let SkillsListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic Skills"
        description="Create reusable skills that can enable rich workflows across your agents."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showSkillFormModal({
                instanceId: instance.data.id,
                onCreate: skill => {
                  if (!instance.data) return;

                  navigate(
                    Paths.instance.skill(
                      organization.data,
                      project.data,
                      instance.data,
                      skill.id
                    )
                  );
                }
              })
            }
          >
            Create Skill
          </Button>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};
