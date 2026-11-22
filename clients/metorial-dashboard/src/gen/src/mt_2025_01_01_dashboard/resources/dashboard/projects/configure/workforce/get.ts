import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureWorkforceGetOutput = {
  object: 'organization.project.workforce_configuration';
  projectId: string;
  autoAddOrganizationMembersToPortals: boolean;
  allowConsumerSkillEditing: boolean;
  allowConsumerSkillSelection: boolean;
  allowOrganizationMemberFullSkillAccess: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureWorkforceGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureWorkforceGetOutput>(
    [
      'project_id',
      'auto_add_organization_members_to_portals',
      'allow_consumer_skill_editing',
      'allow_consumer_skill_selection',
      'allow_organization_member_full_skill_access',
      'updated_at'
    ],
    1
  );
