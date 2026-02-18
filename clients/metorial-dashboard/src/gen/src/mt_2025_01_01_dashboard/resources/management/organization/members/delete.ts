import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationMembersDeleteOutput = {
  object: 'organization.member';
  id: string;
  status: 'active' | 'deleted';
  role: 'member' | 'admin';
  userId: string;
  organizationId: string;
  actorId: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  actor: {
    object: 'organization.actor';
    id: string;
    type: 'member' | 'machine_access';
    organizationId: string;
    name: string;
    email: string | null;
    imageUrl: string;
    teams: {
      id: string;
      name: string;
      slug: string;
      assignmentId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  };
};

export let mapManagementOrganizationMembersDeleteOutput =
  mtMap.object<ManagementOrganizationMembersDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    role: mtMap.objectField('role', mtMap.passthrough()),
    userId: mtMap.objectField('user_id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
    lastActiveAt: mtMap.objectField('last_active_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
    actor: mtMap.objectField(
      'actor',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        teams: mtMap.objectField(
          'teams',
          mtMap.array(
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              assignmentId: mtMap.objectField(
                'assignment_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  });

