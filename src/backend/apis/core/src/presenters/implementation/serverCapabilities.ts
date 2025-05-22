import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverCapabilitiesType } from '../types';
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

    resourceTemplates: serverCapabilities.flatMap(s =>
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

          id: v.string(),

          server: v1ServerPreview.schema,
          server_variant: v1ServerVariantPreview.schema,
          server_version: v.nullable(v1ServerVersionPreview.schema),

          capabilities: v.record(v.record(v.any())),

          info: v.object({
            name: v.string(),
            version: v.nullable(v.string())
          })
        })
      ),

      tools: v.array(
        v.object({
          mcp_server_id: v.string(),

          name: v.string(),
          description: v.optional(v.string()),
          inputSchema: v.optional(v.any()),
          outputSchema: v.optional(v.any()),
          annotations: v.optional(v.any())
        })
      ),
      prompts: v.array(
        v.object({
          mcp_server_id: v.string(),

          name: v.string(),
          description: v.optional(v.string()),
          arguments: v.optional(v.any())
        })
      ),
      resourceTemplates: v.array(
        v.object({
          mcp_server_id: v.string(),

          uriTemplate: v.string(),
          name: v.string(),
          description: v.optional(v.string()),
          mimeType: v.optional(v.string())
        })
      )
    })
  )
  .build();
