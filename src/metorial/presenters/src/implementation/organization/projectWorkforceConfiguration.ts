import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectWorkforceConfigurationType } from '../../types';

export let v1ProjectWorkforceConfigurationPresenter = Presenter.create(
  projectWorkforceConfigurationType
)
  .presenter(async ({ project }) => ({
    object: 'organization.project.workforce_configuration' as const,
    project_id: project.id,
    auto_add_organization_members_to_portals: project.autoAddOrganizationMembersToPortals,
    allow_consumer_skill_editing: project.allowConsumerSkillEditing,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.workforce_configuration'),
      project_id: v.string(),
      auto_add_organization_members_to_portals: v.boolean(),
      allow_consumer_skill_editing: v.boolean(),
      updated_at: v.date()
    })
  )
  .build();
