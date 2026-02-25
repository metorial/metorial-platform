import { mtMap } from '@metorial/util-resource-mapper';

export type ToolCallsListOutput = {
  items: {
    object: 'session.tool_call';
    id: string;
    toolKey: string;
    type: string;
    status: string;
    source: string;
    transport: string;
    sessionId: string;
    messageId: string;
    sessionProviderId: string | null;
    connectionId: string | null;
    providerRunId: string | null;
    tool: {
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
      specificationId: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    error: {
      object: 'session.error';
      id: string;
      code: string;
      message: string;
      data: Record<string, any>;
      status: 'processing' | 'processed';
      sessionId: string;
      providerRunId: string | null;
      connectionId: string | null;
      groupId: string | null;
      similarErrorCount: number;
      createdAt: Date;
    } | null;
    input: Record<string, any> | null;
    output: Record<string, any> | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapToolCallsListOutput = mtMap.object<ToolCallsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        toolKey: mtMap.objectField('tool_key', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        source: mtMap.objectField('source', mtMap.passthrough()),
        transport: mtMap.objectField('transport', mtMap.passthrough()),
        sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
        messageId: mtMap.objectField('message_id', mtMap.passthrough()),
        sessionProviderId: mtMap.objectField(
          'session_provider_id',
          mtMap.passthrough()
        ),
        connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
        providerRunId: mtMap.objectField(
          'provider_run_id',
          mtMap.passthrough()
        ),
        tool: mtMap.objectField(
          'tool',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            key: mtMap.objectField('key', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            capabilities: mtMap.objectField(
              'capabilities',
              mtMap.passthrough()
            ),
            constraints: mtMap.objectField(
              'constraints',
              mtMap.array(mtMap.passthrough())
            ),
            instructions: mtMap.objectField(
              'instructions',
              mtMap.array(mtMap.passthrough())
            ),
            inputSchema: mtMap.objectField(
              'input_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            outputSchema: mtMap.objectField(
              'output_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            tags: mtMap.objectField(
              'tags',
              mtMap.object({
                destructive: mtMap.objectField(
                  'destructive',
                  mtMap.passthrough()
                ),
                readOnly: mtMap.objectField('read_only', mtMap.passthrough())
              })
            ),
            specificationId: mtMap.objectField(
              'specification_id',
              mtMap.passthrough()
            ),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        error: mtMap.objectField(
          'error',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            code: mtMap.objectField('code', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough()),
            data: mtMap.objectField('data', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
            providerRunId: mtMap.objectField(
              'provider_run_id',
              mtMap.passthrough()
            ),
            connectionId: mtMap.objectField(
              'connection_id',
              mtMap.passthrough()
            ),
            groupId: mtMap.objectField('group_id', mtMap.passthrough()),
            similarErrorCount: mtMap.objectField(
              'similar_error_count',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        ),
        input: mtMap.objectField('input', mtMap.passthrough()),
        output: mtMap.objectField('output', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type ToolCallsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  sessionTemplateId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  toolId?: string | string[] | undefined;
};

export let mapToolCallsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      sessionTemplateId: mtMap.objectField(
        'session_template_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionProviderId: mtMap.objectField(
        'session_provider_id',
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
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerAuthConfigId: mtMap.objectField(
        'provider_auth_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      toolId: mtMap.objectField(
        'tool_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

