import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsTemplatesListOutput = {
  items: {
    object: 'skill.template';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    owner: 'system' | 'tenant';
    slug: string;
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    storeId: string;
    items: {
      object: 'skill.template.item';
      id: string;
      type: 'integration' | 'provider';
      integration: {
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
          enableCallbackTools: boolean;
          useIntegrationNameInToolNames: boolean | null;
        };
        createdAt: Date;
        updatedAt: Date;
        archivedAt: Date | null;
      } | null;
      provider: {
        object: 'provider#preview';
        id: string;
        name: string;
        description: string | null;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsTemplatesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsTemplatesListOutput>(
    [
      7,
      [
        1,
        [
          'store_id',
          [
            'items',
            0,
            [
              2,
              [
                1,
                [
                  [
                    'integration',
                    0,
                    [
                      1,
                      [
                        [
                          'configuration',
                          0,
                          [
                            1,
                            [
                              'can_attach_custom_tool_filters',
                              'can_attach_custom_provider_config',
                              'can_override_tool_filters',
                              'enable_callback_tools',
                              'use_integration_name_in_tool_names'
                            ]
                          ]
                        ],
                        'created_at',
                        'updated_at',
                        'archived_at'
                      ]
                    ]
                  ],
                  ['provider', 0, 8],
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
    ],
    1
  );

export type ManagementInstanceSkillsTemplatesListQuery = {
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
  owner?: 'system' | 'tenant' | ('system' | 'tenant')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceSkillsTemplatesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsTemplatesListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'integration_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
