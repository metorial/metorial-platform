import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationTeamsProjectsSetOutput = {
  object: 'management.team';
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  projects: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    project: {
      object: 'organization.project';
      id: string;
      status: 'active' | 'deleted';
      slug: string;
      name: string;
      organizationId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    roles: {
      id: string;
      role: {
        object: 'management.team.role';
        id: string;
        organizationId: string;
        name: string;
        slug: string;
        description: string | null;
        permissions: string[];
        createdAt: Date;
        updatedAt: Date;
      };
      createdAt: Date;
      updatedAt: Date;
    }[];
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationTeamsProjectsSetOutput =
  mtMap.object<ManagementOrganizationTeamsProjectsSetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    projects: mtMap.objectField(
      'projects',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          project: mtMap.objectField(
            'project',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          roles: mtMap.objectField(
            'roles',
            mtMap.array(
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                role: mtMap.objectField(
                  'role',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    slug: mtMap.objectField('slug', mtMap.passthrough()),
                    description: mtMap.objectField('description', mtMap.passthrough()),
                    permissions: mtMap.objectField(
                      'permissions',
                      mtMap.array(mtMap.passthrough())
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationTeamsProjectsSetBody = {
  projectId: string;
  teamRoleIds: string[];
};

export let mapManagementOrganizationTeamsProjectsSetBody =
  mtMap.object<ManagementOrganizationTeamsProjectsSetBody>({
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    teamRoleIds: mtMap.objectField('team_role_ids', mtMap.array(mtMap.passthrough()))
  });
