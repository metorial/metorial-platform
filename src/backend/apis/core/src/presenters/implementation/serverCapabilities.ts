import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverCapabilitiesType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';
import { v1ServerPreview } from './serverPreview';
import { v1ServerVariantPreview } from './serverVariantPreview';
import { v1ServerVersionPreview } from './serverVersionPreview';

export let v1ServerCapabilitiesPresenter = Presenter.create(serverCapabilitiesType)
  .presenter(async ({ serverCapabilities }, opts) => ({
    object: 'server.capabilities',

    mcp_servers: serverCapabilities.map(s => ({
      object: 'server.capabilities.mcp_server',

      id: s.id,

      server: v1ServerPreview(s.server),
      server_variant: v1ServerVariantPreview(s.serverVariant, s.server),
      server_version: s.serverVersion
        ? v1ServerVersionPreview(s.serverVersion, s.serverVariant, s.server)
        : null,
      server_deployment: s.serverDeployment
        ? v1ServerDeploymentPreview(s.serverDeployment, s.server)
        : null,

      info: {
        name: s.info?.name ?? s.server.name,
        version: s.info?.version ?? null
      },
      capabilities: s.capabilities
    })),

    tools: serverCapabilities.flatMap(s =>
      (s.tools ?? []).map(t => ({
        mcp_server_id: s.id,
        ...t
      }))
    ) as any,

    prompts: serverCapabilities.flatMap(s =>
      (s.prompts ?? []).map(t => ({
        mcp_server_id: s.id,
        ...t
      }))
    ) as any,

    resource_templates: serverCapabilities.flatMap(s =>
      (s.resourceTemplates ?? []).map(t => ({
        mcp_server_id: s.id,
        ...t
      }))
    ) as any
  }))
  .schema(
    v.object({
      object: v.literal('server.capabilities'),

      mcp_servers: v.array(
        v.object({
          object: v.literal('server.capabilities.mcp_server'),

          id: v.string({
            name: 'id',
            description: 'The unique identifier for this MCP server capability entry'
          }),

          server: v1ServerPreview.schema, // assumed to already be annotated
          server_variant: v1ServerVariantPreview.schema,
          server_version: v.nullable(v1ServerVersionPreview.schema),
          server_deployment: v.nullable(v1ServerDeploymentPreview.schema),

          capabilities: v.record(v.record(v.any()), {
            name: 'capabilities',
            description: 'Nested key-value object describing capability types and details'
          }),

          info: v.object(
            {
              name: v.string({
                name: 'name',
                description: 'Human-readable name of the MCP server'
              }),
              version: v.nullable(
                v.string({
                  name: 'version',
                  description: 'Optional version string of the MCP server'
                })
              )
            },
            {
              name: 'info',
              description: 'Metadata about the MCP server'
            }
          )
        }),
        {
          name: 'mcp_servers',
          description: 'List of MCP servers and their capabilities'
        }
      ),

      tools: v.array(
        v.object(
          {
            mcp_server_id: v.string({
              name: 'mcp_server_id',
              description: 'Identifier linking this tool to a specific MCP server'
            }),

            name: v.string({
              name: 'name',
              description: 'Name of the tool'
            }),

            description: v.optional(
              v.string({
                name: 'description',
                description: 'Optional description of the tool'
              })
            ),

            input_schema: v.optional(
              v.any({
                name: 'input_schema',
                description: "Optional JSON schema for the tool's input"
              })
            ),

            output_schema: v.optional(
              v.any({
                name: 'output_schema',
                description: "Optional JSON schema for the tool's output"
              })
            ),

            annotations: v.optional(
              v.any({
                name: 'annotations',
                description: 'Optional annotations associated with the tool'
              })
            )
          },
          {
            name: 'tool',
            description: 'A tool provided by an MCP server'
          }
        ),
        {
          name: 'tools',
          description: 'List of tools available on MCP servers'
        }
      ),

      prompts: v.array(
        v.object(
          {
            mcp_server_id: v.string({
              name: 'mcp_server_id',
              description: 'Identifier linking this prompt to a specific MCP server'
            }),

            name: v.string({
              name: 'name',
              description: 'Name of the prompt'
            }),

            description: v.optional(
              v.string({
                name: 'description',
                description: 'Optional description of the prompt'
              })
            ),

            arguments: v.optional(
              v.any({
                name: 'arguments',
                description: 'Optional argument specification for the prompt'
              })
            )
          },
          {
            name: 'prompt',
            description: 'A prompt associated with an MCP server'
          }
        ),
        {
          name: 'prompts',
          description: 'List of prompts available on MCP servers'
        }
      ),

      resource_templates: v.array(
        v.object(
          {
            mcp_server_id: v.string({
              name: 'mcp_server_id',
              description: 'Identifier linking this resource template to a specific MCP server'
            }),

            uri_template: v.string({
              name: 'uri_template',
              description: 'URI template used to access this resource'
            }),

            name: v.string({
              name: 'name',
              description: 'Name of the resource template'
            }),

            description: v.optional(
              v.string({
                name: 'description',
                description: 'Optional description of the resource template'
              })
            ),

            mime_type: v.optional(
              v.string({
                name: 'mime_type',
                description: 'Optional MIME type for the resource template output'
              })
            )
          },
          {
            name: 'resource_template',
            description: 'A resource template provided by an MCP server'
          }
        ),
        {
          name: 'resource_templates',
          description: 'List of resource templates available on MCP servers'
        }
      )
    })
  )
  .build();
