import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import { customProviderVersionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderVersionPresenter } from '../../presenters';
import { SubspaceCustomProviderVersion } from '../../presenters/types';
import { customProviderGroup } from './customProvider';

export let customProviderVersionGroup = customProviderGroup.use(async ctx => {
  if (!ctx.params.customProviderVersionId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderVersionId is required',
        description: 'The customProviderVersionId path parameter is required.'
      })
    );
  }

  let customProviderVersion = await customProviderVersionService.get({
    instance: ctx.instance,
    customProviderVersionId: ctx.params.customProviderVersionId
  });

  return { customProviderVersion };
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

export let customProviderVersionController = Controller.create(
  {
    name: 'Custom Provider Versions',
    description:
      'Versions represent different releases of a custom provider. Each version can be deployed to environments.'
  },
  {
    list: customProviderGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/versions',
          'customProviders.versions.list'
        ),
        {
          name: 'List custom provider versions',
          description: 'Returns a paginated list of versions for a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(subspaceCustomProviderVersionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Filter by status (queued, deploying, deployment_succeeded, deployment_failed)'
            }),
            ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version IDs'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderVersionService.list({
          instance: ctx.instance,
          customProviderIds: [ctx.customProvider.id],
          status: normalizeArrayParam(ctx.query.status) as
            | ('queued' | 'deploying' | 'deployment_succeeded' | 'deployment_failed')[]
            | undefined,
          ids: normalizeArrayParam(ctx.query.ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderVersion =>
          subspaceCustomProviderVersionPresenter.present({
            customProviderVersion: customProviderVersion as SubspaceCustomProviderVersion
          })
        );
      }),

    get: customProviderVersionGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/versions/:customProviderVersionId',
          'customProviders.versions.get'
        ),
        {
          name: 'Get custom provider version',
          description: 'Retrieves a specific version of a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderVersionPresenter)
      .do(async ctx => {
        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion: ctx.customProviderVersion as SubspaceCustomProviderVersion
        });
      }),

    create: customProviderGroup
      .post(
        instancePath(
          'custom-providers/:customProviderId/versions',
          'customProviders.versions.create'
        ),
        {
          name: 'Create custom provider version',
          description: 'Creates a new version for a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          from: customProviderFromValidator,
          config: customProviderConfigValidator
        })
      )
      .output(subspaceCustomProviderVersionPresenter)
      .do(async ctx => {
        let customProviderVersion = await customProviderVersionService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor,
          customProviderId: ctx.customProvider.id,
          from: convertKeysToCamelCase(ctx.body.from) as any,
          config: ctx.body.config
        });

        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion: customProviderVersion as SubspaceCustomProviderVersion
        });
      })
  }
);
