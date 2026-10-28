import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureWorkforceUpdateOutput = {
  object: 'organization.project.workforce_configuration';
  projectId: string;
  autoAddOrganizationMembersToPortals: boolean;
  allowConsumerSkillEditing: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureWorkforceUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureWorkforceUpdateOutput>(
    [
      'project_id',
      'auto_add_organization_members_to_portals',
      'allow_consumer_skill_editing',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsConfigureWorkforceUpdateBody = {
  autoAddOrganizationMembersToPortals?: boolean | undefined;
  allowConsumerSkillEditing?: boolean | undefined;
};

export let mapDashboardProjectsConfigureWorkforceUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureWorkforceUpdateBody>([
    'auto_add_organization_members_to_portals',
    'allow_consumer_skill_editing'
  ]);
