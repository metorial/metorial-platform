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
  SkillTemplatesEmptyState,
  SkillTemplatesList
} from '../../../scenes/skills/templateGrid';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

export let SkillTemplatesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skill Templates"
        description="Templates let you reuse files, providers, and integrations when creating new skills."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSkillTemplateFormModal({
                instanceId: instance.data.id,
                onCreate: skillTemplate => {
                  navigate(
                    Paths.instance.skillTemplate(
                      organization.data,
                      project.data,
                      instance.data,
                      skillTemplate.id
                    )
                  );
                }
              })
            }
          >
            Create Template
          </Button>
        }
      />

      <SkillTemplatesList emptyState={{ initial: () => <SkillTemplatesEmptyState /> }} />
    </ContentLayout>
  ));
};
