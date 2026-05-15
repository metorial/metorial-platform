import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsListOutput = {
  items: {
    object: 'skill';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string;
    clientName: string;
    clientDescription: string | null;
    clientMetadata: Record<string, any> | null;
    license: string | null;
    compatibility: string | null;
    metadata: Record<string, any>;
    storeId: string;
    hierarchy: {
      object: 'skill.hierarchy';
      type: 'root' | 'fork' | 'duplicated';
      parentSkillId: string | null;
      creator: {
        type: 'organization_actor' | 'consumer' | 'unknown';
        name: string;
        imageUrl: string | null;
        email: string | null;
        organizationActor: {
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
        } | null;
        consumer: {
          object: 'consumer';
          id: string;
          name: string;
          email: string;
          imageUrl: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      } | null;
      fork: {
        id: string;
        parentSkillId: string;
        creator: {
          type: 'organization_actor' | 'consumer' | 'unknown';
          name: string;
          imageUrl: string | null;
          email: string | null;
          organizationActor: {
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
          } | null;
          consumer: {
            object: 'consumer';
            id: string;
            name: string;
            email: string;
            imageUrl: string;
            createdAt: Date;
            updatedAt: Date;
          } | null;
        } | null;
        originalCreator: {
          type: 'organization_actor' | 'consumer' | 'unknown';
          name: string;
          imageUrl: string | null;
          email: string | null;
          organizationActor: {
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
          } | null;
          consumer: {
            object: 'consumer';
            id: string;
            name: string;
            email: string;
            imageUrl: string;
            createdAt: Date;
            updatedAt: Date;
          } | null;
        } | null;
        createdAt: Date;
      } | null;
      entity: {
        object: 'skill.entity';
        id: string;
        name: string;
        slug: string;
        description: string | null;
        parentSkillId: string;
        createdAt: Date;
        updatedAt: Date;
      };
    };
    integrations: {
      object: 'integration#preview';
      id: string;
      slug: string;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      configuration: {
        canAttachCustomToolFilters: boolean;
        canAttachCustomProviderConfig: boolean;
        canOverrideToolFilters: boolean;
      };
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    }[];
    providers: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsListOutput = mtMap.object<SkillsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        clientName: mtMap.objectField('client_name', mtMap.passthrough()),
        clientDescription: mtMap.objectField(
          'client_description',
          mtMap.passthrough()
        ),
        clientMetadata: mtMap.objectField(
          'client_metadata',
          mtMap.passthrough()
        ),
        license: mtMap.objectField('license', mtMap.passthrough()),
        compatibility: mtMap.objectField('compatibility', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        storeId: mtMap.objectField('store_id', mtMap.passthrough()),
        hierarchy: mtMap.objectField(
          'hierarchy',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            parentSkillId: mtMap.objectField(
              'parent_skill_id',
              mtMap.passthrough()
            ),
            creator: mtMap.objectField(
              'creator',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                organizationActor: mtMap.objectField(
                  'organization_actor',
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
                ),
                consumer: mtMap.objectField(
                  'consumer',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              })
            ),
            fork: mtMap.objectField(
              'fork',
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                parentSkillId: mtMap.objectField(
                  'parent_skill_id',
                  mtMap.passthrough()
                ),
                creator: mtMap.objectField(
                  'creator',
                  mtMap.object({
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    organizationActor: mtMap.objectField(
                      'organization_actor',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
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
                        teams: mtMap.objectField(
                          'teams',
                          mtMap.array(
                            mtMap.object({
                              id: mtMap.objectField('id', mtMap.passthrough()),
                              name: mtMap.objectField(
                                'name',
                                mtMap.passthrough()
                              ),
                              slug: mtMap.objectField(
                                'slug',
                                mtMap.passthrough()
                              ),
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
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    consumer: mtMap.objectField(
                      'consumer',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        email: mtMap.objectField('email', mtMap.passthrough()),
                        imageUrl: mtMap.objectField(
                          'image_url',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    )
                  })
                ),
                originalCreator: mtMap.objectField(
                  'original_creator',
                  mtMap.object({
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    organizationActor: mtMap.objectField(
                      'organization_actor',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
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
                        teams: mtMap.objectField(
                          'teams',
                          mtMap.array(
                            mtMap.object({
                              id: mtMap.objectField('id', mtMap.passthrough()),
                              name: mtMap.objectField(
                                'name',
                                mtMap.passthrough()
                              ),
                              slug: mtMap.objectField(
                                'slug',
                                mtMap.passthrough()
                              ),
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
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    consumer: mtMap.objectField(
                      'consumer',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        email: mtMap.objectField('email', mtMap.passthrough()),
                        imageUrl: mtMap.objectField(
                          'image_url',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    )
                  })
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            ),
            entity: mtMap.objectField(
              'entity',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                parentSkillId: mtMap.objectField(
                  'parent_skill_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        ),
        integrations: mtMap.objectField(
          'integrations',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              configuration: mtMap.objectField(
                'configuration',
                mtMap.object({
                  canAttachCustomToolFilters: mtMap.objectField(
                    'can_attach_custom_tool_filters',
                    mtMap.passthrough()
                  ),
                  canAttachCustomProviderConfig: mtMap.objectField(
                    'can_attach_custom_provider_config',
                    mtMap.passthrough()
                  ),
                  canOverrideToolFilters: mtMap.objectField(
                    'can_override_tool_filters',
                    mtMap.passthrough()
                  )
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              archivedAt: mtMap.objectField('archived_at', mtMap.date())
            })
          )
        ),
        providers: mtMap.objectField(
          'providers',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type SkillsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  skillGroupId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapSkillsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillGroupId: mtMap.objectField(
        'skill_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationId: mtMap.objectField(
        'integration_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

