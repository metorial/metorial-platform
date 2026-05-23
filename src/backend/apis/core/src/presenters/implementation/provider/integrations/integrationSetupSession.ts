import { v } from '@mtsrc/validation';
import { SubspaceIntegrationSetupSession } from '@metorial/module-subspace';
import { Presenter } from '@metorial/presenter';
import { integrationSetupSessionType } from '../../../types';
import { v1ProviderPreview } from '../provider';
import { v1IntegrationInstancePresenter } from './integrationInstance';

let setupSessionConfigurationPresenter = (
  configuration: SubspaceIntegrationSetupSession['configuration']
) =>
  configuration
    ? {
        provider_search: configuration.providerSearch
          ? {
              groups: configuration.providerSearch.groups?.map(group => ({
                group_id: group.groupId
              })),
              collections: configuration.providerSearch.collections?.map(collection => ({
                collection_id: collection.collectionId
              })),
              categories: configuration.providerSearch.categories?.map(category => ({
                category_id: category.categoryId
              }))
            }
          : undefined,

        tool_filters: configuration.toolFilters
          ? {
              enabled: configuration.toolFilters.enabled
            }
          : undefined,

        ui: configuration.ui
          ? {
              layout: configuration.ui.layout
            }
          : undefined
      }
    : null;

let setupSessionStepPresenter = (step: SubspaceIntegrationSetupSession['steps'][0]) => ({
  object: 'integration.setup_session.step' as const,
  id: step.id,
  status: step.status,
  url: step.url,
  integration_provider_id: step.integrationProviderId,
  provider: v1ProviderPreview(step.provider),
  provider_setup_session_id: step.providerSetupSessionId,
  integration_instance_provider_id: step.integrationInstanceProviderId,
  created_at: step.createdAt,
  updated_at: step.updatedAt
});

export let v1IntegrationSetupSessionPresenter = Presenter.create(integrationSetupSessionType)
  .presenter(async ({ integrationSetupSession }, opts) => ({
    object: 'integration.setup_session' as const,
    id: integrationSetupSession.id,
    status: integrationSetupSession.status,
    url: integrationSetupSession.url,
    name: integrationSetupSession.name,
    description: integrationSetupSession.description,
    metadata: integrationSetupSession.metadata,
    configuration: setupSessionConfigurationPresenter(
      integrationSetupSession.configuration
    ) as any,
    redirect_url: integrationSetupSession.redirectUrl,
    integration_id: integrationSetupSession.integrationId,
    integration_instance: await v1IntegrationInstancePresenter
      .present({ integrationInstance: integrationSetupSession.integrationInstance }, opts)
      .run(),
    created_at: integrationSetupSession.createdAt,
    updated_at: integrationSetupSession.updatedAt,
    expires_at: integrationSetupSession.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.setup_session'),
      id: v.string(),
      status: v.enumOf(['pending', 'successful', 'expired', 'archived', 'deleted']),
      url: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      configuration: v.nullable(v.record(v.any())),
      redirect_url: v.nullable(v.string()),
      integration_id: v.string(),
      integration_instance: v1IntegrationInstancePresenter.schema,
      created_at: v.date(),
      updated_at: v.date(),
      expires_at: v.date()
    })
  )
  .build();

export let dashboardIntegrationSetupSessionPresenter = Presenter.create(
  integrationSetupSessionType
)
  .presenter(async ({ integrationSetupSession }, opts) => {
    let inner = await v1IntegrationSetupSessionPresenter
      .present({ integrationSetupSession }, opts)
      .run();

    return {
      ...inner,
      integration_instance_id: integrationSetupSession.integrationInstanceId,
      steps: integrationSetupSession.steps.map(setupSessionStepPresenter)
    };
  })
  .schema(
    v.object({
      ...v1IntegrationSetupSessionPresenter.schema.properties,
      integration_instance_id: v.string(),
      steps: v.array(
        v.object({
          object: v.literal('integration.setup_session.step'),
          id: v.string(),
          status: v.enumOf([
            'configured',
            'pending',
            'failed',
            'completed',
            'expired',
            'archived',
            'deleted'
          ]),
          url: v.string(),
          integration_provider_id: v.string(),
          provider: v1ProviderPreview.schema,
          provider_setup_session_id: v.nullable(v.string()),
          integration_instance_provider_id: v.nullable(v.string()),
          created_at: v.date(),
          updated_at: v.date()
        })
      )
    }) as any
  )
  .build();
