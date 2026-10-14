import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsItemsGetOutput = {
  object: 'skill.item';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  type: 'integration' | 'provider';
  skillId: string;
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
};

export let mapSkillsItemsGetOutput =
  /* @__PURE__ */ mapObject<SkillsItemsGetOutput>(
    [
      'skill_id',
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
      'created_at'
    ],
    1
  );
