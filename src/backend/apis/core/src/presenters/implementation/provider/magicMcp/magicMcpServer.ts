import { shadowId } from '@mtsrc/shadow-id';
import { v } from '@mtsrc/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerType } from '../../../types';
import { v1ConsumerIntegrationPresenter } from './consumerOwnership';
import {
  dashboardMagicMcpServerProviderPresenter,
  v1MagicMcpServerProviderPresenter
} from './magicMcpServerProvider';

let magicMcpServerSchema = v.object({
  object: v.literal('magic_mcp.server'),
  id: v.string(),
  status: v.enumOf(['active', 'archived', 'deleted']),
  source: v.enumOf(['manual', 'consumer_provider_template']),
  provider_management_mode: v.enumOf([
    'manual',
    'inherited_from_provider_template',
    'inherited_from_integration'
  ]),
  endpoints: v.array(
    v.object({
      id: v.string(),
      alias: v.string(),
      url: v.string()
    })
  ),
  provider_template_id: v.nullable(v.string()),
  providers: v.array(v1MagicMcpServerProviderPresenter.schema),
  name: v.nullable(v.string()),
  description: v.nullable(v.string()),
  metadata: v.record(v.any()),
  created_at: v.date(),
  updated_at: v.date()
});

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(
    async (
      { magicMcpServer, integration, integrationInstance, magicMcpServerProviders, portal },
      opts
    ) => {
      let providerManagementMode =
        magicMcpServer.ownerType === 'provider_template'
          ? ('inherited_from_provider_template' as const)
          : magicMcpServer.ownerType === 'integration'
            ? ('inherited_from_integration' as const)
            : ('manual' as const);

      return {
        object: 'magic_mcp.server' as const,
        id: magicMcpServer.id,
        status: magicMcpServer.status,
        source: magicMcpServer.source,
        provider_management_mode: providerManagementMode,
        provider_template_id: magicMcpServer.providerTemplateId,

        endpoints: magicMcpServer.aliases.map(a => ({
          id: shadowId('mgsea_', [magicMcpServer.id], [a.slug]),
          alias: a.slug,
          url: portal?.id
            ? `${getConfig().urls.apiUrl}/connect/portal/${portal.slug}/${a.slug}`
            : `${getConfig().urls.apiUrl}/connect/magic/${a.slug}`
        })),

        providers: await Promise.all(
          (magicMcpServerProviders ?? []).map(magicMcpServerProvider =>
            v1MagicMcpServerProviderPresenter
              .present({ magicMcpServer, magicMcpServerProvider }, opts)
              .run()
          )
        ),

        name: magicMcpServer.name,
        description: magicMcpServer.description,
        metadata: magicMcpServer.metadata,
        created_at: magicMcpServer.createdAt,
        updated_at: magicMcpServer.updatedAt
      };
    }
  )
  .schema(magicMcpServerSchema)
  .build();

export let dashboardMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async (input, opts) => {
    let inner = await v1MagicMcpServerPresenter.present(input, opts).run();

    return {
      ...inner,

      providers: await Promise.all(
        (input.magicMcpServerProviders ?? []).map(magicMcpServerProvider =>
          dashboardMagicMcpServerProviderPresenter
            .present({ magicMcpServer: input.magicMcpServer, magicMcpServerProvider }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      magicMcpServerSchema,
      v.object({
        providers: v.array(dashboardMagicMcpServerProviderPresenter.schema)
      })
    ])
  )
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
