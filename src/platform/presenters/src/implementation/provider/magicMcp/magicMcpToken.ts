import { v } from '@lowerdeck/validation';
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
      object: v.literal('magic_mcp.token', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['active', 'deleted'], {
        description: '`deleted` once you delete the token.'
      }),
      secret: v.string({
        description: 'Bearer token used against the connection API.'
      }),
      name: v.nullable(v.string({ description: 'Display name.' })),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      server: v.nullable(v1MagicMcpServerPreview.schema),
      endpoint: v.nullable(v1MagicMcpEndpointPreview.schema),
      groups: v.array(v1MagicMcpGroupPresenter.schema, {
        description: 'Groups the token is scoped to. Empty means the token is not scoped.'
      }),
      metadata: v.record(v.any(), {
        description: 'Custom data you attach to identify or organize this record.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
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
