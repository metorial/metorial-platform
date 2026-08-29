import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureWorkforceUpdateOutput = {
  object: 'organization.project.workforce_configuration';
  projectId: string;
  autoAddOrganizationMembersToPortals: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureWorkforceUpdateOutput =
  mtMap.object<DashboardProjectsConfigureWorkforceUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    autoAddOrganizationMembersToPortals: mtMap.objectField(
      'auto_add_organization_members_to_portals',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardProjectsConfigureWorkforceUpdateBody = {
  autoAddOrganizationMembersToPortals?: boolean | undefined;
};

export let mapDashboardProjectsConfigureWorkforceUpdateBody =
  mtMap.object<DashboardProjectsConfigureWorkforceUpdateBody>({
    autoAddOrganizationMembersToPortals: mtMap.objectField(
      'auto_add_organization_members_to_portals',
      mtMap.passthrough()
    )
  });

