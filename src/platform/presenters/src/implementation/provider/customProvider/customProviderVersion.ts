import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderVersionType } from '../../../types';
import { v1ActorPreviewPresenter } from './actorPreview';
import { v1CustomProviderDeploymentPresenter } from './customProviderDeployment';
import { v1CustomProviderEnvironmentPresenter } from './customProviderEnvironment';

let environmentNestedSchema = v.object(
  {
    object: v.literal('custom_provider.environment', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      name: 'id',
      description: 'Unique ID.',
      examples: ['cpenv_1aBcDeFgHjKlMnPq']
    }),
    is_current_version_for_environment: v.boolean({
      name: 'is_current_version_for_environment',
      description: 'Whether this version is the current one for the environment.'
    }),
    environment: v1CustomProviderEnvironmentPresenter.schema
  },
  { description: 'Environment this version is deployed to.' }
);

export let v1CustomProviderVersionPresenter = Presenter.create(customProviderVersionType)
  .presenter(async ({ customProviderVersion }, opts) => ({
    object: 'custom_provider.version' as const,

    id: customProviderVersion.id,
    status: customProviderVersion.status,

    config: customProviderVersion.payload?.config
      ? {
          object: 'custom_provider.version.config' as const,
          schema: {
            type: 'json_schema' as const,
            schema: customProviderVersion.payload.config.schema
          },
          transformer: customProviderVersion.payload.config.transformer
        }
      : null,

    custom_provider_id: customProviderVersion.customProvider.id,
    provider_id: customProviderVersion.customProvider.provider?.id ?? null,

    identifier: customProviderVersion.versionIdentifier,
    index: customProviderVersion.versionIndex,
    deployment: await v1CustomProviderDeploymentPresenter
      .present(
        {
          customProviderDeployment: {
            ...customProviderVersion.deployment,
            customProvider: customProviderVersion.customProvider,
            creatorActor: customProviderVersion.creatorActor,
            customProviderVersion,
            immutableCodeBucket: customProviderVersion.immutableCodeBucket
          }
        },
        opts
      )
      .run(),

    environments: await Promise.all(
      customProviderVersion.customProviderEnvironmentVersions.map(async envVersion => {
        let env = envVersion.customProviderEnvironment;
        return {
          object: 'custom_provider.environment' as const,
          id: env.id,
          is_current_version_for_environment:
            customProviderVersion.providerVersion?.oid ===
            env.providerEnvironment?.currentVersion?.oid,
          environment: await v1CustomProviderEnvironmentPresenter
            .present(
              {
                customProviderEnvironment: {
                  ...env,
                  customProvider: customProviderVersion.customProvider
                }
              },
              opts
            )
            .run()
        };
      })
    ),

    actor: await v1ActorPreviewPresenter
      .present({ actor: customProviderVersion.creatorActor }, opts)
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
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cpv_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['queued', 'deploying', 'deployment_succeeded', 'deployment_failed'], {
        name: 'status',
        description: 'Build status of this version.'
      }),
      config: v.nullable(
        v.object(
          {
            object: v.literal('custom_provider.version.config', {
              description: 'String representing the object’s type.'
            }),
            schema: v.object(
              {
                type: v.literal('json_schema', {
                  description: 'Format of the configuration schema.'
                }),
                schema: v.record(v.any(), {
                  name: 'schema',
                  description: "JSON Schema for the provider's configuration."
                })
              },
              { description: 'Configuration fields for the custom provider.' }
            ),
            transformer: v.string({
              name: 'transformer',
              description: "Code that transforms the provider's configuration."
            })
          },
          { description: 'Configuration for this version.' }
        )
      ),
      index: v.number({
        name: 'index',
        description: 'Sequential number of this version.',
        examples: [1, 2, 3]
      }),
      identifier: v.string({
        name: 'identifier',
        description: 'Human-readable label for this version.',
        examples: ['v1.0.0']
      }),
      deployment: v1CustomProviderDeploymentPresenter.schema,
      environments: v.array(environmentNestedSchema, {
        name: 'environments',
        description: 'Environments this version is deployed to.'
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'Custom provider this version belongs to.',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Associated provider, by ID. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      actor: v1ActorPreviewPresenter.schema,
      container_image: v.optional(
        v.object(
          {
            container_registry: v.string({
              name: 'container_registry',
              description: 'Registry the image is pulled from.',
              examples: ['https://index.docker.io/v1/']
            }),
            container_image_tag: v.string({
              name: 'container_image_tag',
              description: 'Tag selecting the image version.',
              examples: ['v1.0.0']
            }),
            container_image: v.string({
              name: 'container_image',
              description: 'Name of the image in the registry.',
              examples: ['my-app-image']
            })
          },
          {
            description:
              'Container image this version deploys. Only set for `container` providers.'
          }
        )
      ),
      remote_mcp_server: v.optional(
        v.object(
          {
            url: v.string({
              name: 'url',
              description: 'URL where the remote MCP server is reachable.',
              examples: ['https://mcp.example.com']
            }),
            transport: v.string({
              name: 'transport',
              description: 'MCP transport the remote server speaks.',
              examples: ['grpc', 'http']
            })
          },
          {
            description:
              'Remote MCP server this version connects to. Only set for `remote` providers.'
          }
        )
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    }) as any
  )
  .build();
