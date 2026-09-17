import { v } from '@lowerdeck/validation';
import type { SpecificationTriggerGroup } from '@metorial-subspace/provider-utils';
import { Presenter } from '@metorial/presenter';
import { chatConnectionProviderType } from '../../types';
import { v1ProviderConfigPreviewPresenter } from '../provider/config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../provider/config/deploymentPreview';
import { v1ProviderPreview } from '../provider/provider/providerPreview';

export let v1ChatConnectionProviderPresenter = Presenter.create(chatConnectionProviderType)
  .presenter(async ({ chatConnectionProvider }, opts) => {
    let integrationProvider =
      chatConnectionProvider.adapterIntegrationProvider.integrationProvider;
    let provider = integrationProvider.provider;
    let version = integrationProvider.currentVersion;

    return {
      object: 'chat.connection_provider' as const,

      id: chatConnectionProvider.id,
      status: chatConnectionProvider.status,

      provider: v1ProviderPreview(provider),

      deployment: version
        ? await v1ProviderDeploymentPreviewPresenter
            .present({ deployment: { ...version.deployment, provider } }, opts)
            .run()
        : null,

      config: version?.config
        ? await v1ProviderConfigPreviewPresenter
            .present({ config: { ...version.config, provider } }, opts)
            .run()
        : null,

      auth_method_id: version?.authMethod?.id ?? null,
      auth_credentials_id: version?.authCredentials?.id ?? null,

      name: chatConnectionProvider.name,
      description: chatConnectionProvider.description,

      created_at: chatConnectionProvider.createdAt,
      updated_at: chatConnectionProvider.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('chat.connection_provider', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat connection provider identifier',
        examples: ['cip_8kLmNpQrStUvWxYz']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat connection provider status'
      }),

      provider: v1ProviderPreview.schema,

      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),

      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),

      auth_method_id: v.nullable(
        v.string({
          name: 'auth_method_id',
          description: 'The auth method this connection authenticates with, if any',
          examples: ['pam_1aBcDeFgHjKlMnPq']
        })
      ),

      auth_credentials_id: v.nullable(
        v.string({
          name: 'auth_credentials_id',
          description: 'The auth credentials this connection authenticates with, if any',
          examples: ['pac_2bCdEfGhJkLmNpQr']
        })
      ),

      name: v.string({
        name: 'name',
        description: 'Display name of the provider link',
        examples: ['Slack']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the provider link',
          examples: ['Primary Slack workspace connection']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the provider was linked',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the provider link was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let dashboardChatConnectionProviderPresenter = Presenter.create(
  chatConnectionProviderType
)
  .presenter(async ({ chatConnectionProvider }, opts) => {
    let integrationProvider =
      chatConnectionProvider.adapterIntegrationProvider.integrationProvider;

    let inner = await v1ChatConnectionProviderPresenter
      .present({ chatConnectionProvider }, opts)
      .run();
    let triggerGroups = (integrationProvider.provider.defaultVariant?.currentVersion
      ?.specification?.providerTriggerGroups ?? []) as {
      key: string;
      name: string;
      description: string | null;
      value: SpecificationTriggerGroup;
    }[];

    return {
      ...inner,
      auth_credentials_is_managed: integrationProvider.currentVersion?.authCredentials
        ? integrationProvider.currentVersion.authCredentials.origin !== 'tenant_created'
        : false,
      manual_webhook_trigger_groups: triggerGroups
        .filter(
          triggerGroup =>
            triggerGroup.value.invocation.type === 'webhook' &&
            triggerGroup.value.invocation.registration.mode === 'manual'
        )
        .map(triggerGroup => ({
          key: triggerGroup.key,
          name: triggerGroup.name,
          description: triggerGroup.description
        }))
    };
  })
  .schema(
    v.object({
      ...v1ChatConnectionProviderPresenter.schema.properties,
      auth_credentials_is_managed: v.boolean({
        name: 'auth_credentials_is_managed',
        description: 'Whether the selected auth credentials are managed by Metorial',
        examples: [true, false]
      }),
      manual_webhook_trigger_groups: v.array(
        v.object({
          key: v.string({
            name: 'key',
            description: 'Provider-defined key for the trigger group',
            examples: ['events']
          }),
          name: v.string({
            name: 'name',
            description: 'Display name of the trigger group',
            examples: ['Events']
          }),
          description: v.nullable(
            v.string({
              name: 'description',
              description: 'Description of the events delivered through the trigger group'
            })
          )
        }),
        {
          name: 'manual_webhook_trigger_groups',
          description:
            'Trigger groups that require the user to register a Metorial webhook receiver with the provider'
        }
      )
    }) as any
  )
  .build();
