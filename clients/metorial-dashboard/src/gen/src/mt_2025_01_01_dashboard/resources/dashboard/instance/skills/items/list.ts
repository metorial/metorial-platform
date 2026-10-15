import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsItemsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsItemsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsItemsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsItemsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  type?:
    | 'integration'
    | 'provider'
    | ('integration' | 'provider')[]
    | undefined;
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsItemsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsItemsListQuery>([
    3,
    [[0, [1, ['integration_id', 'provider_id', ['created_at', 1, 5]]]]]
  ]);
