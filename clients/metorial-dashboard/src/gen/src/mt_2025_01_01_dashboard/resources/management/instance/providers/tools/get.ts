import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProvidersToolsGetOutput = {
  object: 'provider.tool';
  id: string;
  key: string;
  name: string;
  description: string | null;
  capabilities: Record<string, any>;
  constraints: string[];
  instructions: string[];
  inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
  tags: { destructive: boolean | null; readOnly: boolean | null } | null;
  toolCategoryKeys: string[];
  specificationId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProvidersToolsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProvidersToolsGetOutput>(
    [
      'input_schema',
      'output_schema',
      ['tags', 0, [1, ['read_only']]],
      'tool_category_keys',
      'specification_id',
      'provider_id',
      'created_at',
      'updated_at'
    ],
    1
  );
