import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateSkill,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillTemplate
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';

export let SkillTemplateLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillTemplateId } = useParams();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);
  let createSkill = useCreateSkill();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;

  let skillTemplatePathParams = [
    organization.data,
    project.data,
    instance.data,
    skillTemplate.data?.id ?? skillTemplateId
  ] as const;

  let cloneAsSkill = () => {
    if (!instance.data || !skillTemplate.data) return;

    showSkillCloneFormModal({
      title: 'Clone Template as Skill',
      description: 'Choose a name and description for the new skill.',
      submitLabel: 'Clone as Skill',
      initialName: skillTemplate.data.name,
      initialDescription: skillTemplate.data.description,
      onSubmit: async values => {
        let [skill] = await createSkill.mutate({
          instanceId: instance.data!.id,
          templateId: skillTemplate.data!.id,
          name: values.name,
          description: values.description
        });

        if (!skill) return false;

        navigate(
          Paths.instance.skill(organization.data, project.data, instance.data, skill.id)
        );
      }
    });
  };

  return (
    <ContentLayout>
      <PageHeader
        title={skillTemplate.data?.name ?? '...'}
        description={skillTemplate.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skill Templates',
            href: Paths.instance.skillTemplates(organization.data, project.data, instance.data)
          },
          {
            label: skillTemplate.data?.name ?? '...',
            href: Paths.instance.skillTemplate(...skillTemplatePathParams)
          }
        ]}
        actions={
          <Button
            size="2"
            disabled={!instance.data || !skillTemplate.data}
            onClick={cloneAsSkill}
          >
            Clone as Skill
          </Button>
        }
      />

      <InitialLoadBoundary>
        {renderWithLoader({ skillTemplate })(() => (
          <>
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.skillTemplate(...skillTemplatePathParams)
                },
                {
                  label: 'Settings',
                  to: Paths.instance.skillTemplate(...skillTemplatePathParams, 'settings')
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
