import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardBootOutput = {
  object: 'metorial.boot';
  user: {
    object: 'user';
    id: string;
    status: 'active' | 'deleted';
    type: 'user' | 'consumer';
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
    type: 'default';
    slug: string;
    name: string;
    imageUrl: string;
    magicMcpOrigin: string | null;
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
      policies: {
        object: 'management.access_policy#preview';
        id: string;
        type: 'everyone' | 'admin' | 'custom';
        name: string;
        slug: string;
      }[];
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
        member: {
          object: 'organization.member#preview';
          id: string;
          status: 'active' | 'deleted';
          role: 'member' | 'admin';
        } | null;
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
    namespaces: {
      object: 'namespace.property';
      id: string;
      type: 'organization' | 'portal';
      namespace: {
        object: 'namespace';
        id: string;
        value: string;
        purposes: (
          | 'metorial_platform'
          | 'metorial_portal'
          | 'metorial_portal_single'
        )[];
        compartment: {
          object: 'namespace.compartment';
          id: string;
          type: 'managed';
          priority: number;
          value: string;
        };
        createdAt: Date;
        updatedAt: Date;
      };
      createdAt: Date;
      updatedAt: Date;
    }[];
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
      type: 'default';
      slug: string;
      name: string;
      imageUrl: string;
      magicMcpOrigin: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  instances: ({
    object: 'organization.instance';
    id: string;
    slug: string;
    name: string;
    organizationId: string;
    sandboxId: string | null;
    type: 'development' | 'production';
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
  } & {
    organization: {
      object: 'organization';
      id: string;
      type: 'default';
      slug: string;
      name: string;
      imageUrl: string;
      magicMcpOrigin: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  consumers: {
    object: 'consumer#boot';
    id: string;
    name: string;
    email: string;
    isOrganizationMember: boolean;
    isPortalConsumer: boolean;
    isManuallyCreated: boolean;
    isPending: boolean;
    createdAt: Date;
    updatedAt: Date;
    organization: {
      object: 'organization';
      id: string;
      type: 'default';
      slug: string;
      name: string;
      imageUrl: string;
      magicMcpOrigin: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    profiles: {
      object: 'consumer.profile.item#boot';
      id: string;
      organization: {
        object: 'organization';
        id: string;
        type: 'default';
        slug: string;
        name: string;
        imageUrl: string;
        magicMcpOrigin: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      instance: {
        object: 'organization.instance';
        id: string;
        slug: string;
        name: string;
        organizationId: string;
        sandboxId: string | null;
        type: 'development' | 'production';
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
      };
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
      profile: {
        object: 'consumer.profile#boot';
        id: string;
        name: string;
        email: string;
        imageUrl: string;
        consumerId: string;
        status: 'active' | 'invited';
        createdAt: Date;
        updatedAt: Date;
      };
      surface: {
        object: 'consumer.surface';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      portal: {
        object: 'portal';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string;
        slug: string;
        description: string | null;
        urls: { type: 'default' | 'namespace'; url: string }[];
        namespaces: {
          object: 'namespace.property';
          id: string;
          type: 'organization' | 'portal';
          namespace: {
            object: 'namespace';
            id: string;
            value: string;
            purposes: (
              | 'metorial_platform'
              | 'metorial_portal'
              | 'metorial_portal_single'
            )[];
            compartment: {
              object: 'namespace.compartment';
              id: string;
              type: 'managed';
              priority: number;
              value: string;
            };
            createdAt: Date;
            updatedAt: Date;
          };
          createdAt: Date;
          updatedAt: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
      } | null;
    }[];
  }[];
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
            type: mtMap.objectField('type', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
            magicMcpOrigin: mtMap.objectField(
              'magic_mcp_origin',
              mtMap.passthrough()
            ),
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
                policies: mtMap.objectField(
                  'policies',
                  mtMap.array(
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      slug: mtMap.objectField('slug', mtMap.passthrough())
                    })
                  )
                ),
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
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    member: mtMap.objectField(
                      'member',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        role: mtMap.objectField('role', mtMap.passthrough())
                      })
                    ),
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
                          createdAt: mtMap.objectField(
                            'created_at',
                            mtMap.date()
                          ),
                          updatedAt: mtMap.objectField(
                            'updated_at',
                            mtMap.date()
                          )
                        })
                      )
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              })
            ),
            namespaces: mtMap.objectField(
              'namespaces',
              mtMap.array(
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  namespace: mtMap.objectField(
                    'namespace',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      value: mtMap.objectField('value', mtMap.passthrough()),
                      purposes: mtMap.objectField(
                        'purposes',
                        mtMap.array(mtMap.passthrough())
                      ),
                      compartment: mtMap.objectField(
                        'compartment',
                        mtMap.object({
                          object: mtMap.objectField(
                            'object',
                            mtMap.passthrough()
                          ),
                          id: mtMap.objectField('id', mtMap.passthrough()),
                          type: mtMap.objectField('type', mtMap.passthrough()),
                          priority: mtMap.objectField(
                            'priority',
                            mtMap.passthrough()
                          ),
                          value: mtMap.objectField('value', mtMap.passthrough())
                        })
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
                type: mtMap.objectField('type', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                magicMcpOrigin: mtMap.objectField(
                  'magic_mcp_origin',
                  mtMap.passthrough()
                ),
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
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            organizationId: mtMap.objectField(
              'organization_id',
              mtMap.passthrough()
            ),
            sandboxId: mtMap.objectField('sandbox_id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
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
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            organization: mtMap.objectField(
              'organization',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                magicMcpOrigin: mtMap.objectField(
                  'magic_mcp_origin',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        )
      ])
    )
  ),
  consumers: mtMap.objectField(
    'consumers',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        isOrganizationMember: mtMap.objectField(
          'isOrganizationMember',
          mtMap.passthrough()
        ),
        isPortalConsumer: mtMap.objectField(
          'isPortalConsumer',
          mtMap.passthrough()
        ),
        isManuallyCreated: mtMap.objectField(
          'isManuallyCreated',
          mtMap.passthrough()
        ),
        isPending: mtMap.objectField('isPending', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        organization: mtMap.objectField(
          'organization',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
            magicMcpOrigin: mtMap.objectField(
              'magic_mcp_origin',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        profiles: mtMap.objectField(
          'profiles',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              organization: mtMap.objectField(
                'organization',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  magicMcpOrigin: mtMap.objectField(
                    'magic_mcp_origin',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              instance: mtMap.objectField(
                'instance',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  organizationId: mtMap.objectField(
                    'organization_id',
                    mtMap.passthrough()
                  ),
                  sandboxId: mtMap.objectField(
                    'sandbox_id',
                    mtMap.passthrough()
                  ),
                  type: mtMap.objectField('type', mtMap.passthrough()),
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
                      organizationId: mtMap.objectField(
                        'organization_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                })
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
              profile: mtMap.objectField(
                'profile',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  email: mtMap.objectField('email', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  consumerId: mtMap.objectField(
                    'consumer_id',
                    mtMap.passthrough()
                  ),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              surface: mtMap.objectField(
                'surface',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              portal: mtMap.objectField(
                'portal',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  urls: mtMap.objectField(
                    'urls',
                    mtMap.array(
                      mtMap.object({
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        url: mtMap.objectField('url', mtMap.passthrough())
                      })
                    )
                  ),
                  namespaces: mtMap.objectField(
                    'namespaces',
                    mtMap.array(
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        namespace: mtMap.objectField(
                          'namespace',
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            value: mtMap.objectField(
                              'value',
                              mtMap.passthrough()
                            ),
                            purposes: mtMap.objectField(
                              'purposes',
                              mtMap.array(mtMap.passthrough())
                            ),
                            compartment: mtMap.objectField(
                              'compartment',
                              mtMap.object({
                                object: mtMap.objectField(
                                  'object',
                                  mtMap.passthrough()
                                ),
                                id: mtMap.objectField(
                                  'id',
                                  mtMap.passthrough()
                                ),
                                type: mtMap.objectField(
                                  'type',
                                  mtMap.passthrough()
                                ),
                                priority: mtMap.objectField(
                                  'priority',
                                  mtMap.passthrough()
                                ),
                                value: mtMap.objectField(
                                  'value',
                                  mtMap.passthrough()
                                )
                              })
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    )
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          )
        )
      })
    )
  )
});

