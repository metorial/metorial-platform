import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { describe, expect, it } from 'vitest';
import { CONNECTION_STATUS_OUTPUT_SCHEMA } from './connectionStatusSchema';
import type { buildConnectionStatusReport } from './connectionStatusTool';
import { mcpOutputSchemaNormalizer } from './mcpOutputSchemaNormalizer';

type Report = Awaited<ReturnType<typeof buildConnectionStatusReport>>;

// Typed against the real report so a renamed or dropped field fails to compile.
let report: { summary: string } & Report['data'] = {
  summary: '1 provider(s) linked to this connection, serving 0 tool(s).',
  session: { id: 'ses_1', created_at: new Date() },
  connection: {
    id: 'scon_1',
    transport: 'mcp',
    mcp_transport: 'streamable_http',
    mcp_protocol_version: '2025-03-26',
    state: 'active',
    created_at: new Date(),
    last_active_at: new Date()
  },
  providers: [
    {
      id: 'sprv_1',
      name: 'Example',
      tag: 'example',
      health: 'unavailable',
      tool_count: 1,
      blocked_tool_count: 1,
      tools: [
        { name: 'example_search', availability: 'available' },
        { name: 'example_write', availability: 'blocked' }
      ],
      tools_are_connection_scoped: false,
      tools_last_discovered_at: null,
      error: { code: 'provider_unreachable', message: 'The MCP server could not be reached.' },
      provider_connection: {
        state: 'failed',
        transport: 'streamable_http',
        protocol_version: null,
        server_info: null,
        last_error: {
          code: 'provider_unreachable',
          message: 'The MCP server could not be reached.'
        }
      },
      auth: {
        configured: true,
        auth_method: { key: 'oauth', type: 'oauth2', name: 'OAuth' },
        auth_config: {
          id: 'pauc_1',
          name: 'Default',
          type: 'oauth',
          status: 'active',
          granted_scopes: []
        },
        credentials: { id: 'pacr_1', type: 'oauth', status: 'active', granted_scopes: [] }
      },
      recent_auth_errors: [
        {
          code: 'auth_token_refresh_failed',
          message: 'Refresh failed',
          created_at: new Date()
        }
      ]
    }
  ],
  recent_errors: [
    {
      type: 'provider_discovery_failed',
      code: 'provider_unreachable',
      message: 'The MCP server could not be reached.',
      created_at: new Date()
    }
  ]
};

// Dates only reach the client as JSON, so validate what the client actually sees.
let serialized = JSON.parse(JSON.stringify(report));

let validator = new AjvJsonSchemaValidator();

let validate = (schema: Record<string, any>, value: unknown) =>
  validator.getValidator(schema as any)(value);

describe('metorial_connection_status output schema', () => {
  it('accepts the report the tool returns', async () => {
    let res = await validate(CONNECTION_STATUS_OUTPUT_SCHEMA, serialized);
    expect(res.valid, res.errorMessage).toBe(true);
  });

  it('accepts a report without a connection, providers or errors', async () => {
    let res = await validate(CONNECTION_STATUS_OUTPUT_SCHEMA, {
      summary: 'No providers are linked to this connection.',
      session: { id: 'ses_1', created_at: new Date().toISOString() },
      connection: null,
      providers: [],
      recent_errors: []
    });

    expect(res.valid, res.errorMessage).toBe(true);
  });

  it('still validates after the MCP output schema normalizer runs', async () => {
    let normalized = mcpOutputSchemaNormalizer(CONNECTION_STATUS_OUTPUT_SCHEMA, {
      isRoot: true
    })!;

    expect(normalized.properties.$attachments).toBeTruthy();

    let res = await validate(normalized, serialized);
    expect(res.valid, res.errorMessage).toBe(true);
  });

  it('rejects a report that is missing the summary', async () => {
    let { summary, ...withoutSummary } = serialized;
    let res = await validate(CONNECTION_STATUS_OUTPUT_SCHEMA, withoutSummary);

    expect(res.valid).toBe(false);
  });

  it('rejects an unknown tool availability value', () => {
    let res = validate(CONNECTION_STATUS_OUTPUT_SCHEMA, {
      ...serialized,
      providers: [
        {
          ...serialized.providers[0],
          tools: [{ name: 'example_search', availability: 'maybe' }]
        }
      ]
    });

    expect(res.valid).toBe(false);
  });

  it('rejects an unknown provider health value', async () => {
    let res = await validate(CONNECTION_STATUS_OUTPUT_SCHEMA, {
      ...serialized,
      providers: [{ ...serialized.providers[0], health: 'broken' }]
    });

    expect(res.valid).toBe(false);
  });
});
