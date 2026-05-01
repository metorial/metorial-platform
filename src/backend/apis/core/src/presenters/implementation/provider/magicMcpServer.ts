import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerType } from '../../types';
import { v1ConsumerIntegrationPresenter } from './consumerOwnership';
import { v1IntegrationPresenter } from './integration';
import { v1IntegrationInstancePresenter } from './integrationInstance';
import { v1IntegrationInstanceProviderPresenter } from './integrationInstanceProvider';

let magicMcpServerSchema = v.object({
  object: v.literal('magic_mcp.server'),
  id: v.string(),
  status: v.enumOf(['active', 'archived', 'deleted']),
  source: v.enumOf(['manual', 'consumer_provider_template']),
  provider_management_mode: v.enumOf(['manual', 'inherited_from_provider_template']),
  provider_template_id: v.nullable(v.string()),
  provider_template_backing_id: v.nullable(v.string()),
  integration_id: v.nullable(v.string()),
  integration_instance_id: v.nullable(v.string()),
  endpoints: v.array(
    v.object({
      id: v.string(),
      alias: v.string(),
      url: v.string()
    })
  ),
  integration: v.nullable(v1IntegrationPresenter.schema),
  integration_instance: v.nullable(v1IntegrationInstancePresenter.schema),
  providers: v.array(v1IntegrationInstanceProviderPresenter.schema),
  name: v.nullable(v.string()),
  description: v.nullable(v.string()),
  metadata: v.record(v.any()),
  created_at: v.date(),
  updated_at: v.date()
});

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(
    async (
      {
        magicMcpServer,
        integration,
        integrationInstance,
        integrationInstanceProviders,
        portal
      },
      opts
    ) => ({
      object: 'magic_mcp.server' as const,
      id: magicMcpServer.id,
      status: magicMcpServer.status,
      source: magicMcpServer.source,
      provider_management_mode: magicMcpServer.providerTemplateId
        ? ('inherited_from_provider_template' as const)
        : ('manual' as const),
      provider_template_id: magicMcpServer.providerTemplateId,
      provider_template_backing_id: magicMcpServer.providerTemplateId,
      integration_id: integration?.id ?? null,
      integration_instance_id: integrationInstance?.id ?? null,
      endpoints: magicMcpServer.aliases.map(a => ({
        id: shadowId('mgse_', [magicMcpServer.id], [a.slug]),
        alias: a.slug,
        url: portal?.id
          ? `${getConfig().urls.apiUrl}/connect/portal/${portal.slug}/${a.slug}`
          : `${getConfig().urls.apiUrl}/connect/magic/${a.slug}`
      })),
      integration: integration
        ? await v1IntegrationPresenter.present({ integration }, opts).run()
        : null,
      integration_instance: integrationInstance
        ? await v1IntegrationInstancePresenter.present({ integrationInstance }, opts).run()
        : null,
      providers: await Promise.all(
        (integrationInstanceProviders ?? []).map(integrationInstanceProvider =>
          v1IntegrationInstanceProviderPresenter
            .present({ integrationInstanceProvider }, opts)
            .run()
        )
      ),
      name: magicMcpServer.name,
      description: magicMcpServer.description,
      metadata: magicMcpServer.metadata,
      created_at: magicMcpServer.createdAt,
      updated_at: magicMcpServer.updatedAt
    })
  )
  .schema(magicMcpServerSchema)
  .build();

export let dashboardMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async (input, opts) => {
    let inner = await v1MagicMcpServerPresenter.present(input, opts).run();

    return {
      ...inner
    };
  })
  .schema(v.intersection([magicMcpServerSchema, v.object({})]))
  .build();

export let consumerMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer, portal }, opts) => {
    let inner = await v1MagicMcpServerPresenter
      .present({ magicMcpServer, portal }, opts)
      .run();

    return {
      ...inner,
      consumer_integrations: await Promise.all(
        magicMcpServer.consumerIntegrations.map(consumerIntegration =>
          v1ConsumerIntegrationPresenter.present({ consumerIntegration }, opts).run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpServerPresenter.schema,
      v.object({
        consumer_integrations: v.array(v1ConsumerIntegrationPresenter.schema)
      })
    ])
  )
  .build();
