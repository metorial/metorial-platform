import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceCustomProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v, ValidationTypeValue } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderPresenter } from '../../presenters';

export let customProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderId is required',
        description: 'The customProviderId path parameter is required.'
      })
    );
  }

  let customProvider = await subspaceCustomProviderService.get({
    instance: ctx.instance,
    customProviderId: ctx.params.customProviderId
  });

  return { customProvider };
});

export let customProviderFromValidator = v.union([
  v.object(
    {
      type: v.literal('container'),
      image_ref: v.string({ description: 'Container image reference' }),
      username: v.optional(v.string({ description: 'Registry username' })),
      password: v.optional(v.string({ description: 'Registry password' }))
    },
    { name: 'container', description: 'Deploy from a container image' }
  ),
  v.object(
    {
      type: v.literal('remote'),
      remote_url: v.string({ description: 'Remote MCP server URL' }),
      oauth_config: v.optional(
        v.record(v.any(), { description: 'Remote server configuration' })
      ),
      protocol: v.enumOf(['sse', 'streamable_http'], { description: 'MCP protocol to use' })
    },
    { name: 'remote', description: 'Connect to a remote MCP server' }
  ),
  v.object(
    {
      type: v.literal('function'),
      files: v.array(
        v.object({
          filename: v.string({ description: 'File name' }),
          content: v.string({ description: 'File content' }),
          encoding: v.optional(
            v.enumOf(['utf-8', 'base64'], { description: 'Content encoding' })
          )
        }),
        { description: 'Source files' }
      ),
      env: v.record(v.string(), { description: 'Environment variables' }),
      runtime: v.union([
        v.object({
          identifier: v.literal('nodejs'),
          version: v.enumOf(['24.x', '22.x'], { description: 'Node.js version' })
        }),
        v.object({
          identifier: v.literal('python'),
          version: v.enumOf(['3.14', '3.13', '3.12'], { description: 'Python version' })
        })
      ])
    },
    { name: 'function', description: 'Deploy as a serverless function' }
  ),
  v.object(
    {
      type: v.literal('function'),
      env: v.record(v.string(), { description: 'Environment variables' }),
      runtime: v.union([
        v.object({
          identifier: v.literal('nodejs'),
          version: v.enumOf(['24.x', '22.x'], { description: 'Node.js version' })
        }),
        v.object({
          identifier: v.literal('python'),
          version: v.enumOf(['3.14', '3.13', '3.12'], { description: 'Python version' })
        })
      ]),
      repository: v.union([
        v.object({
          repository_id: v.string({ description: 'Repository ID' }),
          branch: v.string({ description: 'Branch name' })
        }),
        v.object({
          type: v.literal('git'),
          repository_url: v.string({ description: 'Git repository URL' }),
          branch: v.string({ description: 'Branch name' })
        })
      ])
    },
    { name: 'function', description: 'Deploy as a serverless function' }
  )
]);

type CustomProviderFromInput = Parameters<
  typeof subspaceCustomProviderService.create
>[0]['from'];

export let mapCustomProviderFrom = (
  type: ValidationTypeValue<typeof customProviderFromValidator>
): CustomProviderFromInput => {
  if (type.type === 'container') {
    return {
      type: 'container' as const,
      repository: {
        imageRef: type.image_ref,
        username: type.username,
        password: type.password
      }
    } satisfies CustomProviderFromInput;
  }

  if (type.type === 'remote') {
    return {
      type: 'remote' as const,
      remoteUrl: type.remote_url,
      oauthConfig: type.oauth_config,
      protocol: type.protocol
    } satisfies CustomProviderFromInput;
  }

  if (type.type === 'function') {
    if ('files' in type) {
      return {
        type: 'function' as const,
        files: type.files.map(file => ({
          filename: file.filename,
          content: file.content,
          encoding: file.encoding
        })),
        env: type.env,
        runtime: type.runtime
      } satisfies CustomProviderFromInput;
    }

    return {
      type: 'function' as const,
      env: type.env,
      runtime: type.runtime,
      files: [],
      repository:
        'repository_id' in type.repository
          ? {
              repositoryId: type.repository.repository_id,
              branch: type.repository.branch
            }
          : {
              type: 'git' as const,
              repositoryUrl: type.repository.repository_url,
              branch: type.repository.branch
            }
    } satisfies CustomProviderFromInput;
  }

  throw new Error('Invalid from type');
};

export let customProviderConfigValidator = v.optional(
  v.object({
    schema: v.record(v.any(), { description: 'Configuration JSON schema' }),
    transformer: v.string({ description: 'Configuration transformer code' })
  })
);

export let customProviderController = Controller.create(
  {
    name: 'Custom Providers',
    description:
      'Custom providers allow you to deploy your own MCP servers. Create providers from container images, remote URLs, or serverless functions.'
  },
  {
    list: instanceGroup
      .get(instancePath('custom-providers', 'customProviders.list'), {
        name: 'List custom providers',
        description: 'Returns a paginated list of custom providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(subspaceCustomProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by status (active, archived)' }
            ),
            type: v.optional(
              v.union([
                v.enumOf(['container', 'function', 'remote']),
                v.array(v.enumOf(['container', 'function', 'remote']))
              ]),
              { description: 'Filter by type (container, function, remote)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider IDs (matches providers connected to sessions)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderService.list({
          instance: ctx.instance,
          allowDeleted: false,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          status: normalizeArrayParam(ctx.query.status),
          type: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProvider =>
          subspaceCustomProviderPresenter.present({
            customProvider: customProvider
          })
        );
      }),

    get: customProviderGroup
      .get(instancePath('custom-providers/:customProviderId', 'customProviders.get'), {
        name: 'Get custom provider',
        description: 'Retrieves a specific custom provider by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        return subspaceCustomProviderPresenter.present({
          customProvider: ctx.customProvider
        });
      }),

    create: instanceGroup
      .post(instancePath('custom-providers', 'customProviders.create'), {
        name: 'Create custom provider',
        description: 'Creates a new custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['My Custom Provider'] }),
          description: v.optional(
            v.string({ examples: ['A custom MCP server for my application'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ environment: 'production' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          from: customProviderFromValidator,
          config: customProviderConfigValidator
        })
      )
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        let customProvider = await subspaceCustomProviderService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          from: mapCustomProviderFrom(ctx.body.from),
          config: ctx.body.config
        });

        return subspaceCustomProviderPresenter.present({
          customProvider: customProvider
        });
      }),

    update: customProviderGroup
      .patch(instancePath('custom-providers/:customProviderId', 'customProviders.update'), {
        name: 'Update custom provider',
        description: 'Updates a specific custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Provider Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'staging' }] }), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        let customProvider = await subspaceCustomProviderService.update({
          instance: ctx.instance,
          organizationActor: ctx.actor,

          customProviderId: ctx.customProvider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return subspaceCustomProviderPresenter.present({
          customProvider: customProvider
        });
      })
  }
);
