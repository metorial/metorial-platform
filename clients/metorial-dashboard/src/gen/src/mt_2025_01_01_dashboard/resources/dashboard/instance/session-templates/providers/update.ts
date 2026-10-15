import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionTemplatesProvidersUpdateOutput = {
  object: 'session.template.provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  toolFilter:
    | { type: 'allow_all'; ignoreParentFilters: boolean }
    | {
        type: 'filter';
        filters: (
          | { type: 'tool_keys'; keys: string[] }
          | { type: 'tool_categories'; keys: string[] }
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )[];
        ignoreParentFilters: boolean;
      };
  providerId: string;
  sessionTemplateId: string;
  deployment: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  config: {
    object: 'provider.config#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  authConfig: { object: 'provider.auth_config#preview'; id: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSessionTemplatesProvidersUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSessionTemplatesProvidersUpdateOutput>(
    [
      ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
      'provider_id',
      'session_template_id',
      [
        'deployment',
        0,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      [
        'config',
        0,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      'auth_config',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceSessionTemplatesProvidersUpdateBody = {
  toolFilters?:
    | (
        | { type: 'tool_keys'; keys: string[] }
        | { type: 'tool_categories'; keys: string[] }
        | { type: 'tool_regex'; pattern: string }
        | { type: 'resource_regex'; pattern: string }
        | { type: 'resource_uris'; uris: string[] }
        | { type: 'prompt_keys'; keys: string[] }
        | { type: 'prompt_regex'; pattern: string }
      )
    | (
        | { type: 'tool_keys'; keys: string[] }
        | { type: 'tool_categories'; keys: string[] }
        | { type: 'tool_regex'; pattern: string }
        | { type: 'resource_regex'; pattern: string }
        | { type: 'resource_uris'; uris: string[] }
        | { type: 'prompt_keys'; keys: string[] }
        | { type: 'prompt_regex'; pattern: string }
      )[]
    | null
    | undefined;
};

export let mapDashboardInstanceSessionTemplatesProvidersUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSessionTemplatesProvidersUpdateBody>(
    ['tool_filters']
  );
