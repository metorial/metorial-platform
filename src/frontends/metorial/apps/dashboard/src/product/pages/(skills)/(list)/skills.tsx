import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { useSearchParams } from 'react-router-dom';
import {
  CreateSkillButton,
  CreateSkillWithAgent,
  SkillsEmptyState,
  SkillsList
} from '../../../scenes/skills/overview/skillsList';
import { skillViewQueryKey } from '../../../scenes/skills/overview/skillViews';
import {
  SkillTemplatesEmptyState,
  SkillTemplatesList
} from '../../../scenes/skills/templateGrid';

export let SkillsPage = () => {
  let currentInstance = useCurrentInstance();
  let [searchParams] = useSearchParams();
  let showTemplates = searchParams.get(skillViewQueryKey) == 'templates';

  return renderWithLoader({ instance: currentInstance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skills"
        description="Create reusable skills that extend integrations with documents, custom logic, and resources."
        actions={<CreateSkillButton instanceId={instance.data.id} />}
      />

      <CreateSkillWithAgent instanceId={instance.data.id} />

      {showTemplates ? (
        <SkillTemplatesList
          withSkillViews
          emptyState={{
            initial: () => <SkillTemplatesEmptyState />,
            filtered: 'No templates match your search.'
          }}
        />
      ) : (
        <SkillsList
          emptyState={{
            initial: () => <SkillsEmptyState />,
            filtered: 'No skills match your search.'
          }}
        />
      )}
    </ContentLayout>
  ));
};
