import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServersCapabilitiesListOutput = {
  object: 'server.capabilities';
  mcpServers: {
    object: 'server.capabilities.mcp_server';
    id: string;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    serverVariant: {
      object: 'server.server_variant#preview';
      id: string;
      identifier: string;
      serverId: string;
      source:
        | { type: 'docker'; docker: { image: string } }
        | { type: 'remote'; remote: { domain: string } };
      createdAt: Date;
    };
    serverVersion: {
      object: 'server.server_version#preview';
      id: string;
      identifier: string;
      serverId: string;
      serverVariantId: string;
      source:
        | { type: 'docker'; docker: { image: string; tag: string } }
        | { type: 'remote'; remote: { domain: string } };
      createdAt: Date;
    } | null;
    serverDeployment: {
      object: 'server.server_deployment#preview';
      id: string;
      name: string | null;
      description: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
      server: {
        object: 'server#preview';
        id: string;
        name: string;
        description: string | null;
        type: 'public';
        createdAt: Date;
        updatedAt: Date;
      };
    } | null;
    capabilities: Record<string, Record<string, any>>;
    info: { name: string; version: string | null };
  }[];
  tools: {
    mcpServerId: string;
    name: string;
    description?: string | undefined;
    inputSchema?: any | undefined;
    outputSchema?: any | undefined;
    annotations?: any | undefined;
  }[];
  prompts: {
    mcpServerId: string;
    name: string;
    description?: string | undefined;
    arguments?: any | undefined;
  }[];
  resourceTemplates: {
    mcpServerId: string;
    uriTemplate: string;
    name: string;
    description?: string | undefined;
    mimeType?: string | undefined;
  }[];
};

export let mapDashboardInstanceServersCapabilitiesListOutput =
  mtMap.object<DashboardInstanceServersCapabilitiesListOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    mcpServers: mtMap.objectField(
      'mcp_servers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          server: mtMap.objectField(
            'server',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              type: mtMap.objectField('type', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          serverVariant: mtMap.objectField(
            'server_variant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              source: mtMap.objectField(
                'source',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      docker: mtMap.objectField(
                        'docker',
                        mtMap.object({
                          image: mtMap.objectField('image', mtMap.passthrough())
                        })
                      ),
                      remote: mtMap.objectField(
                        'remote',
                        mtMap.object({
                          domain: mtMap.objectField(
                            'domain',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  )
                ])
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          serverVersion: mtMap.objectField(
            'server_version',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              serverVariantId: mtMap.objectField(
                'server_variant_id',
                mtMap.passthrough()
              ),
              source: mtMap.objectField(
                'source',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      docker: mtMap.objectField(
                        'docker',
                        mtMap.object({
                          image: mtMap.objectField(
                            'image',
                            mtMap.passthrough()
                          ),
                          tag: mtMap.objectField('tag', mtMap.passthrough())
                        })
                      ),
                      remote: mtMap.objectField(
                        'remote',
                        mtMap.object({
                          domain: mtMap.objectField(
                            'domain',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  )
                ])
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          serverDeployment: mtMap.objectField(
            'server_deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              server: mtMap.objectField(
                'server',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          ),
          capabilities: mtMap.objectField('capabilities', mtMap.passthrough()),
          info: mtMap.objectField(
            'info',
            mtMap.object({
              name: mtMap.objectField('name', mtMap.passthrough()),
              version: mtMap.objectField('version', mtMap.passthrough())
            })
          )
        })
      )
    ),
    tools: mtMap.objectField(
      'tools',
      mtMap.array(
        mtMap.object({
          mcpServerId: mtMap.objectField('mcp_server_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          inputSchema: mtMap.objectField('inputSchema', mtMap.passthrough()),
          outputSchema: mtMap.objectField('outputSchema', mtMap.passthrough()),
          annotations: mtMap.objectField('annotations', mtMap.passthrough())
        })
      )
    ),
    prompts: mtMap.objectField(
      'prompts',
      mtMap.array(
        mtMap.object({
          mcpServerId: mtMap.objectField('mcp_server_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          arguments: mtMap.objectField('arguments', mtMap.passthrough())
        })
      )
    ),
    resourceTemplates: mtMap.objectField(
      'resourceTemplates',
      mtMap.array(
        mtMap.object({
          mcpServerId: mtMap.objectField('mcp_server_id', mtMap.passthrough()),
          uriTemplate: mtMap.objectField('uriTemplate', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          mimeType: mtMap.objectField('mimeType', mtMap.passthrough())
        })
      )
    )
  });

export type DashboardInstanceServersCapabilitiesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  serverDeploymentIds?: string | string[] | undefined;
  serverVariantIds?: string | string[] | undefined;
  serverIds?: string | string[] | undefined;
  serverVersionIds?: string | string[] | undefined;
  serverImplementationIds?: string | string[] | undefined;
};

export let mapDashboardInstanceServersCapabilitiesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      serverDeploymentIds: mtMap.objectField(
        'server_deployment_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverVariantIds: mtMap.objectField(
        'server_variant_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverIds: mtMap.objectField(
        'server_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverVersionIds: mtMap.objectField(
        'server_version_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverImplementationIds: mtMap.objectField(
        'server_implementation_ids',
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

