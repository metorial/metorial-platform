import { mapObject } from '@metorial/util-resource-mapper/compact';

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
          'metorial_platform' | 'metorial_portal' | 'metorial_portal_single'
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
              'metorial_platform' | 'metorial_portal' | 'metorial_portal_single'
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

export let mapDashboardBootOutput =
  /* @__PURE__ */ mapObject<DashboardBootOutput>(
    [
      [
        'user',
        0,
        [
          1,
          ['first_name', 'last_name', 'image_url', 'created_at', 'updated_at']
        ]
      ],
      [
        'organizations',
        0,
        [
          2,
          [
            3,
            [
              [
                0,
                [
                  1,
                  [
                    'image_url',
                    'magic_mcp_origin',
                    'created_at',
                    'updated_at',
                    [
                      'member',
                      0,
                      [
                        1,
                        [
                          'user_id',
                          'organization_id',
                          'actor_id',
                          'last_active_at',
                          'created_at',
                          'updated_at',
                          'deleted_at',
                          [
                            'actor',
                            0,
                            [
                              1,
                              [
                                'organization_id',
                                'image_url',
                                [
                                  'teams',
                                  0,
                                  [
                                    2,
                                    [
                                      1,
                                      [
                                        'assignment_id',
                                        'created_at',
                                        'updated_at'
                                      ]
                                    ]
                                  ]
                                ],
                                'created_at',
                                'updated_at'
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    [
                      'namespaces',
                      0,
                      [
                        2,
                        [1, [['namespace', 0, 8], 'created_at', 'updated_at']]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ],
      [
        'projects',
        0,
        [
          2,
          [
            3,
            [
              [
                0,
                [
                  1,
                  [
                    'organization_id',
                    'created_at',
                    'updated_at',
                    [
                      'organization',
                      0,
                      [
                        1,
                        [
                          'image_url',
                          'magic_mcp_origin',
                          'created_at',
                          'updated_at'
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ],
      [
        'instances',
        0,
        [
          2,
          [
            3,
            [
              [
                0,
                [
                  1,
                  [
                    'organization_id',
                    'sandbox_id',
                    'created_at',
                    'updated_at',
                    [
                      'project',
                      0,
                      [1, ['organization_id', 'created_at', 'updated_at']]
                    ],
                    [
                      'organization',
                      0,
                      [
                        1,
                        [
                          'image_url',
                          'magic_mcp_origin',
                          'created_at',
                          'updated_at'
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ],
      [
        'consumers',
        0,
        [
          2,
          [
            1,
            [
              'created_at',
              'updated_at',
              [
                'organization',
                0,
                [
                  1,
                  ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at']
                ]
              ],
              [
                'profiles',
                0,
                [
                  2,
                  [
                    1,
                    [
                      [
                        'organization',
                        0,
                        [
                          1,
                          [
                            'image_url',
                            'magic_mcp_origin',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      [
                        'instance',
                        0,
                        [
                          1,
                          [
                            'organization_id',
                            'sandbox_id',
                            'created_at',
                            'updated_at',
                            [
                              'project',
                              0,
                              [
                                1,
                                ['organization_id', 'created_at', 'updated_at']
                              ]
                            ]
                          ]
                        ]
                      ],
                      [
                        'project',
                        0,
                        [1, ['organization_id', 'created_at', 'updated_at']]
                      ],
                      [
                        'profile',
                        0,
                        [
                          1,
                          [
                            'image_url',
                            'consumer_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      ['surface', 0, 8],
                      [
                        'portal',
                        0,
                        [
                          1,
                          [
                            [
                              'namespaces',
                              0,
                              [
                                2,
                                [
                                  1,
                                  [
                                    ['namespace', 0, 8],
                                    'created_at',
                                    'updated_at'
                                  ]
                                ]
                              ]
                            ],
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );
