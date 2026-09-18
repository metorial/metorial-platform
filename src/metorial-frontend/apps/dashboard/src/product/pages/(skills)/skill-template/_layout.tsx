import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateSkill,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillTemplate
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiFileCopyLine } from '@remixicon/react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';

export let SkillTemplateLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillTemplateId } = useParams();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);
  let createSkill = useCreateSkill();
  let navigate = useNavigate();

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
    <DetailsLayout
      entity={skillTemplate.data}
      icon={<RiFileCopyLine />}
      breadcrumbs={[
        {
          label: 'Skill Templates',
          to: Paths.instance.skillTemplates(organization.data, project.data, instance.data)
        },
        {
          label: skillTemplate.data?.name,
          to: Paths.instance.skillTemplate(...skillTemplatePathParams)
        }
      ]}
      tabs={[
        {
          label: 'Overview',
          to: Paths.instance.skillTemplate(...skillTemplatePathParams)
        },
        {
          label: 'Settings',
          to: Paths.instance.skillTemplate(...skillTemplatePathParams, 'settings')
        }
      ]}
      actions={[
        {
          label: 'Clone as Skill',
          disabled: !instance.data || !skillTemplate.data,
          onClick: cloneAsSkill
        }
      ]}
      attributes={
        skillTemplate.data
          ? [
              { label: 'ID', value: <ID id={skillTemplate.data.id} /> },
              {
                label: 'Status',
                value: <Badge color="gray">{skillTemplate.data.status}</Badge>
              },
              { label: 'Slug', value: skillTemplate.data.slug },
              { label: 'Owner', value: skillTemplate.data.owner },
              { label: 'Created', value: <RenderDate date={skillTemplate.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ skillTemplate })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
