import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsTemplatesGetOutput = {
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
};

export let mapDashboardInstanceSkillsTemplatesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsTemplatesGetOutput>(
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
    ],
    1
  );
