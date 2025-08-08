import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardBootOutput = {
  object: 'metorial.boot';
  user: {
    object: 'user';
    id: string;
    status: 'active' | 'deleted';
    type: 'user';
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  };
  organizations: ({
    object: 'organization';
    id: string;
    status: 'active' | 'deleted';
    type: 'default';
    slug: string;
    name: string;
    organizationId: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  } & {
    member: {
      object: 'organization.member';
      id: string;
      status: 'active' | 'deleted';
      role: 'member' | 'admin';
      userId: string;
      organizationId: string;
      actorId: string;
      actor: {
        object: 'organization.actor';
        id: string;
        type: 'member' | 'machine_access';
        organizationId: string;
        actorId: string;
        name: string;
        email: string | null;
        imageUrl: string;
        createdAt: Date;
        updatedAt: Date;
      };
      lastActiveAt: Date;
      deletedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  projects: ({
    object: 'organization.project';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  } & {
    organization: {
      object: 'organization';
      id: string;
      status: 'active' | 'deleted';
      type: 'default';
      slug: string;
      name: string;
      organizationId: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  instances: ({
    object: 'organization.instance';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    type: 'development' | 'production';
    organizationId: string;
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
    createdAt: Date;
    updatedAt: Date;
  } & {
    organization: {
      object: 'organization';
      id: string;
      status: 'active' | 'deleted';
      type: 'default';
      slug: string;
      name: string;
      organizationId: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
};

export let mapDashboardBootOutput = mtMap.object<DashboardBootOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  user: mtMap.objectField(
    'user',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      email: mtMap.objectField('email', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      firstName: mtMap.objectField('first_name', mtMap.passthrough()),
      lastName: mtMap.objectField('last_name', mtMap.passthrough()),
      imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date())
    })
  ),
  organizations: mtMap.objectField(
    'organizations',
    mtMap.array(
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            organizationId: mtMap.objectField(
              'organization_id',
              mtMap.passthrough()
            ),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            member: mtMap.objectField(
              'member',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                role: mtMap.objectField('role', mtMap.passthrough()),
                userId: mtMap.objectField('user_id', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
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
                    actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                lastActiveAt: mtMap.objectField('last_active_at', mtMap.date()),
                deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        )
      ])
    )
  ),
  projects: mtMap.objectField(
    'projects',
    mtMap.array(
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            organizationId: mtMap.objectField(
              'organization_id',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            organization: mtMap.objectField(
              'organization',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        )
      ])
    )
  ),
  instances: mtMap.objectField(
    'instances',
    mtMap.array(
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            organizationId: mtMap.objectField(
              'organization_id',
              mtMap.passthrough()
            ),
            project: mtMap.objectField(
              'project',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            organization: mtMap.objectField(
              'organization',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        )
      ])
    )
  )
});

export type DashboardBootBody = {};

export let mapDashboardBootBody = mtMap.object<DashboardBootBody>({});

