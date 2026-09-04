import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureWorkforceGetOutput = {
  object: 'organization.project.workforce_configuration';
  projectId: string;
  autoAddOrganizationMembersToPortals: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureWorkforceGetOutput =
  mtMap.object<DashboardProjectsConfigureWorkforceGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    autoAddOrganizationMembersToPortals: mtMap.objectField(
      'auto_add_organization_members_to_portals',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

