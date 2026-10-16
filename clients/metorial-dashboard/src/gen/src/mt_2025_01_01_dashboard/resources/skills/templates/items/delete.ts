import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsTemplatesItemsDeleteOutput = {
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
};

export let mapSkillsTemplatesItemsDeleteOutput =
  /* @__PURE__ */ mapObject<SkillsTemplatesItemsDeleteOutput>(
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
    ],
    1
  );
