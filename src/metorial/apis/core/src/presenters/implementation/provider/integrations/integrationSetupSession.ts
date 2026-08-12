import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import type { Prisma as SubspacePrisma } from '@metorial-subspace/db';
import { env } from '@metorial-subspace/module-auth/src/env';
import type { integrationSetupSessionInclude } from '@metorial-subspace/module-integration';
import { integrationSetupSessionType } from '../../../types';
import { v1ProviderPreview } from '../provider';
import { v1IntegrationInstancePresenter } from './integrationInstance';

let setupSessionConfigurationPresenter = (
  configuration: PrismaJson.ProviderSetupSessionConfiguration | null
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

type RawIntegrationSetupSession = SubspacePrisma.IntegrationSetupSessionGetPayload<{
  include: typeof integrationSetupSessionInclude;
}>;

let setupSessionStepPresenter = (
  integrationSetupSession: RawIntegrationSetupSession,
  step: RawIntegrationSetupSession['steps'][number]
) => {
  let setupProvider = step.integrationSetupSessionProvider;
  let providerSetupSession = setupProvider.providerSetupSession;
  let status = setupProvider.integrationInstanceProvider
    ? ('configured' as const)
    : !providerSetupSession
      ? ('pending' as const)
      : providerSetupSession.status === 'pending' &&
          providerSetupSession.expiresAt <= new Date()
        ? ('expired' as const)
        : providerSetupSession.status;

  return {
    object: 'integration.setup_session.step' as const,
    id: step.id,
    status,
    url: `${env.service.PUBLIC_SERVICE_URL}/integration-setup-session/${integrationSetupSession.id}/${step.id}?client_secret=${integrationSetupSession.clientSecret}`,
    integration_provider_id: setupProvider.integrationProvider.id,
    provider: v1ProviderPreview(setupProvider.integrationProvider.provider),
    provider_setup_session_id: providerSetupSession?.id ?? null,
    integration_instance_provider_id: setupProvider.integrationInstanceProvider?.id ?? null,
    created_at: step.createdAt,
    updated_at: step.updatedAt
  };
};

export let v1IntegrationSetupSessionPresenter = Presenter.create(integrationSetupSessionType)
  .presenter(async ({ integrationSetupSession }, opts) => ({
    object: 'integration.setup_session' as const,
    id: integrationSetupSession.id,
    status:
      integrationSetupSession.status === 'pending' &&
      integrationSetupSession.expiresAt <= new Date()
        ? ('expired' as const)
        : integrationSetupSession.status,
    url: `${env.service.PUBLIC_SERVICE_URL}/integration-setup-session/${integrationSetupSession.id}?client_secret=${integrationSetupSession.clientSecret}`,
    name: integrationSetupSession.name,
    description: integrationSetupSession.description,
    metadata: integrationSetupSession.metadata,
    configuration: setupSessionConfigurationPresenter(
      integrationSetupSession.configuration
    ) as any,
    redirect_url: integrationSetupSession.redirectUrl,
    integration_id: integrationSetupSession.integration.id,
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
      integration_instance_id: integrationSetupSession.integrationInstance.id,
      steps: integrationSetupSession.steps.map(step =>
        setupSessionStepPresenter(integrationSetupSession, step)
      )
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
