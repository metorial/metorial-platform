import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
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
    url: integrationSetupSession.clientSecret
      ? `${env.service.INTEGRATIONS_API_URL}/integration-setup-session/${integrationSetupSession.id}/${step.id}?client_secret=${integrationSetupSession.clientSecret}`
      : `${env.service.INTEGRATIONS_API_URL}/integration-setup-session/${integrationSetupSession.id}/${step.id}`,
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
    url: integrationSetupSession.clientSecret
      ? `${env.service.INTEGRATIONS_UI_URL}/integration-setup-session/${integrationSetupSession.id}?client_secret=${integrationSetupSession.clientSecret}`
      : `${env.service.INTEGRATIONS_UI_URL}/integration-setup-session/${integrationSetupSession.id}`,
    name: integrationSetupSession.name,
    description: integrationSetupSession.description,
    metadata: integrationSetupSession.metadata,
    configuration: setupSessionConfigurationPresenter(
      integrationSetupSession.configuration
    ) as any,
    redirect_url: integrationSetupSession.redirectUrl,
    integration_id: integrationSetupSession.integration.id,
    access: {
      source: presentResourceSource(null),
      type: integrationSetupSession.isOwnerLocked
        ? ('owner_locked' as const)
        : ('public' as const),
      visibility: integrationSetupSession.isOwnerOnlyVisible
        ? ('owner' as const)
        : ('anyone' as const),
      owner: presentOwnerActor(integrationSetupSession.ownerActor)
    },
    integration_instance: await v1IntegrationInstancePresenter
      .present({ integrationInstance: integrationSetupSession.integrationInstance }, opts)
      .run(),
    created_at: integrationSetupSession.createdAt,
    updated_at: integrationSetupSession.updatedAt,
    expires_at: integrationSetupSession.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.setup_session', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['iss_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['pending', 'successful', 'expired', 'archived', 'deleted'], {
        description:
          '`pending` until every provider is configured. `successful` once every provider is configured. `expired` past `expires_at` without completion.'
      }),
      url: v.string({
        description: 'Hosted setup page URL.'
      }),
      name: v.nullable(
        v.string({
          description: 'Display name.'
        })
      ),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      configuration: v.nullable(
        v.record(v.any(), {
          description: 'Configuration for the setup flow. `null` when none was set.'
        })
      ),
      redirect_url: v.nullable(
        v.string({
          description:
            'Where to send the user once setup completes. `null` when none was given.'
        })
      ),
      integration_id: v.string({
        description: 'Integration being set up.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      access: resourceAccessSchema,
      integration_instance: v1IntegrationInstancePresenter.schema,
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      expires_at: v.date({
        description: 'When the session expires. Past this time the session reads as `expired`.'
      })
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
      integration_instance_id: v.string({
        description: 'Instance the session sets up.',
        examples: ['ini_4dEfGhJkLmNpQrSt']
      }),
      steps: v.array(
        v.object({
          object: v.literal('integration.setup_session.step', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({
            description: 'Unique ID.'
          }),
          status: v.enumOf(
            ['configured', 'pending', 'failed', 'completed', 'expired', 'archived', 'deleted'],
            {
              description:
                '`configured` once the provider is linked to the instance. Otherwise the provider setup session status.'
            }
          ),
          url: v.string({
            description: 'Hosted setup page URL for this step.'
          }),
          integration_provider_id: v.string({
            description: 'Integration provider this step configures.',
            examples: ['inp_3cDeFgHjKlMnPqRs']
          }),
          provider: v1ProviderPreview.schema,
          provider_setup_session_id: v.nullable(
            v.string({
              description:
                'Provider setup session handling this step. `null` when none exists yet.'
            })
          ),
          integration_instance_provider_id: v.nullable(
            v.string({
              description:
                'Integration instance provider created by this step. `null` until the provider is configured.'
            })
          ),
          created_at: v.date({
            description: 'Creation time.'
          }),
          updated_at: v.date({
            description: 'Last update time.'
          })
        }),
        { description: 'Setup steps, one per provider.' }
      )
    }) as any
  )
  .build();
