import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import { customProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderPresenter } from '../../presenters';
import { SubspaceCustomProvider } from '../../presenters/types';

export let customProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderId is required',
        description: 'The customProviderId path parameter is required.'
      })
    );
  }

  let customProvider = await customProviderService.get({
    instance: ctx.instance,
    customProviderId: ctx.params.customProviderId
  });

  return { customProvider };
});

let customProviderFromValidator = v.union([
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
      config: v.optional(v.record(v.any(), { description: 'Remote server configuration' })),
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
  )
]);

let customProviderConfigValidator = v.optional(
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
            status: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by status (active, archived)'
            }),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by type (container, function, remote)'
            }),
            ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderService.list({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as
            | ('active' | 'archived')[]
            | undefined,
          type: normalizeArrayParam(ctx.query.type) as
            | ('container' | 'function' | 'remote')[]
            | undefined,
          ids: normalizeArrayParam(ctx.query.ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProvider =>
          subspaceCustomProviderPresenter.present({
            customProvider: customProvider as SubspaceCustomProvider
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
          customProvider: ctx.customProvider as SubspaceCustomProvider
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
        let customProvider = await customProviderService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          from: convertKeysToCamelCase(ctx.body.from) as any,
          config: ctx.body.config
        });

        return subspaceCustomProviderPresenter.present({
          customProvider: customProvider as SubspaceCustomProvider
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
        let customProvider = await customProviderService.update({
          instance: ctx.instance,
          organizationActor: ctx.actor,

          customProviderId: ctx.customProvider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return subspaceCustomProviderPresenter.present({
          customProvider: customProvider as SubspaceCustomProvider
        });
      })
  }
);
