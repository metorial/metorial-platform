let nullableString = { type: ['string', 'null'] };
let nullableTimestamp = { type: ['string', 'null'], format: 'date-time' };

let errorSchema = {
  type: ['object', 'null'],
  properties: { code: { type: 'string' }, message: { type: 'string' } },
  required: ['code', 'message']
};

export let CONNECTION_STATUS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Human readable summary of the connection status.'
    },

    session: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' }
      },
      required: ['id']
    },

    connection: {
      type: ['object', 'null'],
      description: 'The connection between the client and Metorial.',
      properties: {
        id: { type: 'string' },
        transport: nullableString,
        mcp_transport: nullableString,
        mcp_protocol_version: nullableString,
        state: nullableString,
        created_at: nullableTimestamp,
        last_active_at: nullableTimestamp
      },
      required: ['id']
    },

    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: nullableString,

          health: {
            type: 'string',
            enum: ['ok', 'degraded', 'unavailable'],
            description:
              'ok: tools are served. degraded: tools are served but errors were recorded. unavailable: no tools could be loaded.'
          },
          tool_count: {
            type: 'integer',
            description: 'Number of tools this provider currently serves.'
          },
          blocked_tool_count: { type: 'integer' },

          tools: {
            type: 'array',
            description:
              'Every tool the provider exposes through tools/list. Blocked tools are not listed to the client and cannot be called, because a tool filter, the authentication method in use, or a missing scope excludes them.',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The tool name as it is listed to the client.'
                },
                availability: { type: 'string', enum: ['available', 'blocked'] }
              },
              required: ['name', 'availability']
            }
          },

          tools_are_connection_scoped: { type: 'boolean' },
          tools_last_discovered_at: nullableTimestamp,

          error: errorSchema,

          provider_connection: {
            type: ['object', 'null'],
            description:
              'Live state of the connection between Metorial and the MCP server, if one is running.',
            properties: {
              state: { type: 'string', enum: ['connecting', 'connected', 'failed', 'closed'] },
              transport: nullableString,
              protocol_version: nullableString,
              server_info: {
                type: ['object', 'null'],
                properties: {
                  name: { type: 'string' },
                  title: nullableString,
                  version: nullableString
                },
                required: ['name']
              },
              last_error: errorSchema
            },
            required: ['state']
          },

          auth: {
            type: 'object',
            description: 'The authentication profile in use. Never contains secrets.',
            properties: {
              configured: { type: 'boolean' },
              auth_method: {
                type: ['object', 'null'],
                properties: {
                  key: { type: 'string' },
                  type: nullableString,
                  name: nullableString
                },
                required: ['key']
              },
              auth_config: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  name: nullableString,
                  type: nullableString,
                  status: nullableString,
                  granted_scopes: { type: 'array' }
                },
                required: ['id']
              },
              credentials: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  type: nullableString,
                  status: nullableString,
                  granted_scopes: { type: 'array' }
                },
                required: ['id']
              }
            },
            required: ['configured']
          },

          recent_auth_errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' }
              },
              required: ['code', 'message']
            }
          }
        },
        required: ['id', 'name', 'health', 'tool_count', 'blocked_tool_count', 'tools']
      }
    },

    recent_errors: {
      type: 'array',
      description: 'Errors recorded on this connection, newest first.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'code', 'message']
      }
    }
  },
  required: ['summary', 'session', 'providers', 'recent_errors']
};
