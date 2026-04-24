import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpEndpointsCreateOutput = {
  object: 'magic_mcp.endpoint';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  slug: string;
  url: string;
  consumerProfileId: string | null;
  sessionTemplateId: string | null;
  sessionId: string | null;
  servers: ({
    object: 'magic_mcp.server#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
    description: string | null;
  } & {
    toolFilters:
      | (
          | { type: 'tool_keys'; keys: string[] }
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )
      | (
          | { type: 'tool_keys'; keys: string[] }
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )[]
      | null;
  })[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceMagicMcpEndpointsCreateOutput =
  mtMap.object<DashboardInstanceMagicMcpEndpointsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    consumerProfileId: mtMap.objectField(
      'consumer_profile_id',
      mtMap.passthrough()
    ),
    sessionTemplateId: mtMap.objectField(
      'session_template_id',
      mtMap.passthrough()
    ),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    servers: mtMap.objectField(
      'servers',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              toolFilters: mtMap.objectField(
                'tool_filters',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      keys: mtMap.objectField(
                        'keys',
                        mtMap.array(mtMap.passthrough())
                      ),
                      pattern: mtMap.objectField(
                        'pattern',
                        mtMap.passthrough()
                      ),
                      uris: mtMap.objectField(
                        'uris',
                        mtMap.array(mtMap.passthrough())
                      )
                    })
                  ),
                  mtMap.unionOption(
                    'array',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          type: mtMap.objectField('type', mtMap.passthrough()),
                          keys: mtMap.objectField(
                            'keys',
                            mtMap.array(mtMap.passthrough())
                          ),
                          pattern: mtMap.objectField(
                            'pattern',
                            mtMap.passthrough()
                          ),
                          uris: mtMap.objectField(
                            'uris',
                            mtMap.array(mtMap.passthrough())
                          )
                        })
                      )
                    ])
                  )
                ])
              )
            })
          )
        ])
      )
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceMagicMcpEndpointsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  consumerProfileId?: string | undefined;
  magicMcpServerIds?: string[] | undefined;
  servers?:
    | {
        magicMcpServerId: string;
        toolFilters?:
          | (
              | { type: 'tool_keys'; keys: string[] }
              | { type: 'tool_regex'; pattern: string }
              | { type: 'resource_regex'; pattern: string }
              | { type: 'resource_uris'; uris: string[] }
              | { type: 'prompt_keys'; keys: string[] }
              | { type: 'prompt_regex'; pattern: string }
            )
          | (
              | { type: 'tool_keys'; keys: string[] }
              | { type: 'tool_regex'; pattern: string }
              | { type: 'resource_regex'; pattern: string }
              | { type: 'resource_uris'; uris: string[] }
              | { type: 'prompt_keys'; keys: string[] }
              | { type: 'prompt_regex'; pattern: string }
            )[]
          | null
          | undefined;
      }[]
    | undefined;
};

export let mapDashboardInstanceMagicMcpEndpointsCreateBody =
  mtMap.object<DashboardInstanceMagicMcpEndpointsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    consumerProfileId: mtMap.objectField(
      'consumer_profile_id',
      mtMap.passthrough()
    ),
    magicMcpServerIds: mtMap.objectField(
      'magic_mcp_server_ids',
      mtMap.array(mtMap.passthrough())
    ),
    servers: mtMap.objectField(
      'servers',
      mtMap.array(
        mtMap.object({
          magicMcpServerId: mtMap.objectField(
            'magic_mcp_server_id',
            mtMap.passthrough()
          ),
          toolFilters: mtMap.objectField(
            'tool_filters',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  keys: mtMap.objectField(
                    'keys',
                    mtMap.array(mtMap.passthrough())
                  ),
                  pattern: mtMap.objectField('pattern', mtMap.passthrough()),
                  uris: mtMap.objectField(
                    'uris',
                    mtMap.array(mtMap.passthrough())
                  )
                })
              ),
              mtMap.unionOption(
                'array',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      keys: mtMap.objectField(
                        'keys',
                        mtMap.array(mtMap.passthrough())
                      ),
                      pattern: mtMap.objectField(
                        'pattern',
                        mtMap.passthrough()
                      ),
                      uris: mtMap.objectField(
                        'uris',
                        mtMap.array(mtMap.passthrough())
                      )
                    })
                  )
                ])
              )
            ])
          )
        })
      )
    )
  });

