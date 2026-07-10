import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerAgentsGetOutput = {
  object: 'consumer.activity_agent';
  agent: {
    object: 'agent';
    id: string;
    type: 'mcp_client' | 'custom' | 'tool_call';
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    actorId: string;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  };
  magicMcpEndpoints: {
    object: 'magic_mcp.endpoint';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    url: string;
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
  }[];
};

export let mapConsumerAgentsGetOutput = mtMap.object<ConsumerAgentsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  agent: mtMap.objectField(
    'agent',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      slug: mtMap.objectField('slug', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      archivedAt: mtMap.objectField('archived_at', mtMap.date())
    })
  ),
  magicMcpEndpoints: mtMap.objectField(
    'magic_mcp_endpoints',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
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
                              type: mtMap.objectField(
                                'type',
                                mtMap.passthrough()
                              ),
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
      })
    )
  )
});

