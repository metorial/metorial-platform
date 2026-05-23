import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpTokenType } from '../../../types';
import { v1MagicMcpEndpointPreview } from './magicMcpEndpointPreview';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';
import { v1ConsumerTokenPresenter } from './consumerOwnership';
import { v1MagicMcpGroupPresenter } from './magicMcpGroup';

export let v1MagicMcpTokenPresenter = Presenter.create(magicMcpTokenType)
  .presenter(async ({ magicMcpToken }, opts) => ({
    object: 'magic_mcp.token' as const,
    id: magicMcpToken.id,
    status: magicMcpToken.status,
    secret: magicMcpToken.secret,
    name: magicMcpToken.name,
    description: magicMcpToken.description,
    metadata: magicMcpToken.metadata,
    server: magicMcpToken.magicMcpServer
      ? v1MagicMcpServerPreview(magicMcpToken.magicMcpServer)
      : null,
    endpoint: magicMcpToken.magicMcpEndpoint
      ? v1MagicMcpEndpointPreview(magicMcpToken.magicMcpEndpoint)
      : null,
    groups: await Promise.all(
      magicMcpToken.groups.map(g =>
        v1MagicMcpGroupPresenter.present({ magicMcpGroup: g.magicMcpGroup }, opts).run({})
      )
    ),
    created_at: magicMcpToken.createdAt,
    updated_at: magicMcpToken.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.token'),
      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      secret: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      server: v.nullable(v1MagicMcpServerPreview.schema),
      endpoint: v.nullable(v1MagicMcpEndpointPreview.schema),
      groups: v.array(v1MagicMcpGroupPresenter.schema),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let consumerMagicMcpTokenPresenter = Presenter.create(magicMcpTokenType)
  .presenter(async ({ magicMcpToken }, opts) => {
    let inner = await v1MagicMcpTokenPresenter.present({ magicMcpToken }, opts).run();

    return {
      ...inner,
      consumer_tokens: await Promise.all(
        magicMcpToken.consumerTokens.map(consumerToken =>
          v1ConsumerTokenPresenter.present({ consumerToken }, opts).run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpTokenPresenter.schema,
      v.object({
        consumer_tokens: v.array(v1ConsumerTokenPresenter.schema)
      })
    ])
  )
  .build();
