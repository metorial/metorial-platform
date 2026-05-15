import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderVersionType } from '../../../types';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1CustomProviderDeploymentPresenter } from './customProviderDeployment';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';

let environmentNestedSchema = v.object({
  object: v.literal('custom_provider.environment', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Environment version reference identifier',
    examples: ['cpenv_1aBcDeFgHjKlMnPq']
  }),
  is_current_version_for_environment: v.boolean({
    name: 'is_current_version_for_environment',
    description: 'Whether this version is the current one for the environment'
  }),
  environment: v1CustomProviderEnvironmentPresenter.schema
});

export let v1CustomProviderVersionPresenter = Presenter.create(customProviderVersionType)
  .presenter(async ({ customProviderVersion }, opts) => ({
    object: 'custom_provider.version' as const,

    id: customProviderVersion.id,
    status: customProviderVersion.status,
    index: customProviderVersion.index,

    config: customProviderVersion.config
      ? {
          object: 'custom_provider.version.config' as const,
          schema: {
            type: 'json_schema' as const,
            schema: customProviderVersion.config.schema
          },
          transformer: customProviderVersion.config.transformer
        }
      : null,

    custom_provider_id: customProviderVersion.customProviderId,
    provider_id: customProviderVersion.providerId ?? null,

    identifier: customProviderVersion.identifier,
    deployment: await v1CustomProviderDeploymentPresenter
      .present({ customProviderDeployment: customProviderVersion.deployment }, opts)
      .run(),

    environments: await Promise.all(
      customProviderVersion.environments.map(
        async (env: (typeof customProviderVersion.environments)[number]) => ({
          object: 'custom_provider.environment' as const,
          id: env.id,
          is_current_version_for_environment: env.isCurrentVersionForEnvironment,
          environment: await v1CustomProviderEnvironmentPresenter
            .present({ customProviderEnvironment: env.environment }, opts)
            .run()
        })
      )
    ),

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderVersion.actor }, opts)
      .run(),

    container_image:
      customProviderVersion.containerTag &&
      customProviderVersion.containerRegistry &&
      customProviderVersion.containerRepository
        ? {
            container_registry: customProviderVersion.containerRegistry.url!,
            container_image_tag: customProviderVersion.containerTag.name!,
            container_image: customProviderVersion.containerRepository.name!
          }
        : undefined,

    remote_mcp_server:
      customProviderVersion.remoteProtocol && customProviderVersion.remoteUrl
        ? {
            url: customProviderVersion.remoteUrl,
            transport: customProviderVersion.remoteProtocol
          }
        : undefined,

    created_at: customProviderVersion.createdAt,
    updated_at: customProviderVersion.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.version', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider version identifier',
        examples: ['cpv_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['queued', 'deploying', 'deployment_succeeded', 'deployment_failed'], {
        name: 'status',
        description: 'Current version status'
      }),
      config: v.nullable(
        v.object({
          object: v.literal('custom_provider.version.config', {
            description: "String representing the object's type"
          }),
          schema: v.object({
            type: v.literal('json_schema'),
            schema: v.record(v.any(), {
              name: 'schema',
              description:
                'JSON Schema defining the configuration fields for the custom provider'
            })
          }),
          transformer: v.string({
            name: 'transformer',
            description: 'Optional jsonata transformer function for the configuration.'
          })
        })
      ),
      index: v.number({
        name: 'index',
        description: 'Version index number',
        examples: [1, 2, 3]
      }),
      identifier: v.string({
        name: 'identifier',
        description: 'Version identifier',
        examples: ['v1.0.0']
      }),
      deployment: v1CustomProviderDeploymentPresenter.schema,
      environments: v.array(environmentNestedSchema, {
        name: 'environments',
        description: 'Environments this version is deployed to'
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'ID of the parent custom provider',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'ID of the associated provider',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      actor: v1ActorPreviewPresenter.schema,
      container_image: v.optional(
        v.object({
          container_registry: v.string({
            name: 'container_registry',
            description: 'URL of the container registry',
            examples: ['https://index.docker.io/v1/']
          }),
          container_image_tag: v.string({
            name: 'container_image_tag',
            description: 'Tag of the container image',
            examples: ['v1.0.0']
          }),
          container_image: v.string({
            name: 'container_image',
            description: 'Name of the container image',
            examples: ['my-app-image']
          })
        })
      ),
      remote_mcp_server: v.optional(
        v.object({
          url: v.string({
            name: 'url',
            description: 'URL of the remote MCP server',
            examples: ['https://mcp.example.com']
          }),
          transport: v.string({
            name: 'transport',
            description: 'Transport protocol for the remote MCP server',
            examples: ['grpc', 'http']
          })
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    }) as any
  )
  .build();
