import { v } from '@mtsrc/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { magicMcpEndpointType } from '../../../types';
import { v1ConsumerIntegrationEndpointPresenter } from './consumerOwnership';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';

let endpointToolFilterSchema = v.union([
  v.object({
    type: v.literal('tool_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('tool_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_uris'),
    uris: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_regex'),
    pattern: v.string()
  })
]);

let endpointToolFiltersSchema = v.nullable(
  v.union([endpointToolFilterSchema, v.array(endpointToolFilterSchema)])
);

let endpointServerSchema = v.intersection([
  v1MagicMcpServerPreview.schema,
  v.object({
    tool_filters: endpointToolFiltersSchema
  })
]);

export let v1MagicMcpEndpointPresenter = Presenter.create(magicMcpEndpointType)
  .presenter(async ({ magicMcpEndpoint, portal }) => ({
    object: 'magic_mcp.endpoint' as const,
    id: magicMcpEndpoint.id,
    status: magicMcpEndpoint.status,
    slug: magicMcpEndpoint.slug,
    url: portal?.id
      ? `${getConfig().urls.apiUrl}/connect/portal/${portal.slug}/${magicMcpEndpoint.slug}`
      : `${getConfig().urls.apiUrl}/connect/magic/${magicMcpEndpoint.slug}`,
    servers: magicMcpEndpoint.servers.map(server => ({
      ...v1MagicMcpServerPreview(server.magicMcpServer),
      tool_filters: server.toolFilters ?? null
    })),
    name: magicMcpEndpoint.name,
    description: magicMcpEndpoint.description,
    metadata: magicMcpEndpoint.metadata,
    created_at: magicMcpEndpoint.createdAt,
    updated_at: magicMcpEndpoint.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.endpoint'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      url: v.string(),
      servers: v.array(endpointServerSchema),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let consumerMagicMcpEndpointPresenter = Presenter.create(magicMcpEndpointType)
  .presenter(async ({ magicMcpEndpoint, portal }, opts) => {
    let inner = await v1MagicMcpEndpointPresenter
      .present({ magicMcpEndpoint, portal }, opts)
      .run();

    return {
      ...inner,
      consumer_integration_endpoints: await Promise.all(
        magicMcpEndpoint.consumerIntegrationEndpoints.map(consumerIntegrationEndpoint =>
          v1ConsumerIntegrationEndpointPresenter
            .present({ consumerIntegrationEndpoint }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpEndpointPresenter.schema,
      v.object({
        consumer_integration_endpoints: v.array(v1ConsumerIntegrationEndpointPresenter.schema)
      })
    ])
  )
  .build();
