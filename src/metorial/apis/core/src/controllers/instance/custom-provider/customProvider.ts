import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v, ValidationTypeValue } from '@lowerdeck/validation';
import { db } from '@metorial-subspace/db';
import { customProviderService } from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  subspaceCustomProviderEnvPresenter,
  subspaceCustomProviderPresenter
} from '@metorial/presenters';

export let customProviderGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.customProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderId is required',
        description: 'The customProviderId path parameter is required.'
      })
    );
  }

  let customProvider = await customProviderService.getCustomProviderById({
    instance: ctx.instance,
    customProviderId: ctx.params.customProviderId
  });

  return { customProvider };
});

export let customProviderFromValidator = v.union(
  [
    v.object(
      {
        type: v.literal('container', {
          description: 'Deploys the provider from a container image.'
        }),
        image_ref: v.string({ description: 'Container image to deploy, with tag.' }),
        username: v.optional(
          v.string({
            description: 'Username for the container registry. Omit for public images.'
          })
        ),
        password: v.optional(
          v.string({
            description: 'Password for the container registry. Omit for public images.'
          })
        )
      },
      { name: 'container', description: 'Deploy from a container image' }
    ),
    v.object(
      {
        type: v.literal('remote', {
          description: 'Connects the provider to a remote MCP server.'
        }),
        remote_url: v.string({ description: 'URL of the remote MCP server.' }),
        oauth_config: v.optional(
          v.record(v.any(), { description: 'OAuth configuration sent to the remote server.' })
        ),
        protocol: v.enumOf(['sse', 'streamable_http', 'stateless'], {
          description:
            'MCP transport to use: `sse` (HTTP+SSE, 2024-11-05), `streamable_http` (session-based Streamable HTTP, 2025-03-26 to 2025-11-25), or `stateless` (sessionless Streamable HTTP, 2026-07-28)'
        })
      },
      { name: 'remote', description: 'Connect to a remote MCP server' }
    ),
    v.object(
      {
        type: v.literal('function', {
          description: 'Deploys the provider from serverless function code.'
        }),
        files: v.array(
          v.object({
            filename: v.string({ description: 'File path within the deployment.' }),
            content: v.string({ description: 'Content of the file.' }),
            encoding: v.optional(
              v.enumOf(['utf-8', 'base64'], { description: 'Content encoding.' })
            )
          }),
          { description: 'Source files to deploy.' }
        ),
        env: v.record(v.string(), {
          description: 'Environment variables available to the function.'
        }),
        runtime: v.union(
          [
            v.object({
              identifier: v.literal('nodejs', { description: 'Node.js runtime.' }),
              version: v.enumOf(['24.x', '22.x'], { description: 'Node.js version.' })
            }),
            v.object({
              identifier: v.literal('python', { description: 'Python runtime.' }),
              version: v.enumOf(['3.14', '3.13', '3.12'], { description: 'Python version.' })
            })
          ],
          { description: 'Runtime the function runs on.' }
        )
      },
      { name: 'function', description: 'Deploy as a serverless function' }
    ),
    v.object(
      {
        type: v.literal('function', {
          description: 'Deploys the provider from serverless function code.'
        }),
        env: v.record(v.string(), {
          description: 'Environment variables available to the function.'
        }),
        runtime: v.union(
          [
            v.object({
              identifier: v.literal('nodejs', { description: 'Node.js runtime.' }),
              version: v.enumOf(['24.x', '22.x'], { description: 'Node.js version.' })
            }),
            v.object({
              identifier: v.literal('python', { description: 'Python runtime.' }),
              version: v.enumOf(['3.14', '3.13', '3.12'], { description: 'Python version.' })
            })
          ],
          { description: 'Runtime the function runs on.' }
        ),
        repository: v.union(
          [
            v.object({
              repository_id: v.string({
                description: 'Linked SCM repository to deploy, by ID.'
              }),
              branch: v.string({ description: 'Branch to deploy.' }),
              path: v.optional(
                v.string({ description: 'Subdirectory of the branch to deploy.' })
              )
            }),
            v.object({
              type: v.literal('git', { description: 'Deploys from a Git repository URL.' }),
              repository_url: v.string({
                description: 'URL of the Git repository to deploy.'
              }),
              branch: v.string({ description: 'Branch to deploy.' }),
              path: v.optional(
                v.string({ description: 'Subdirectory of the branch to deploy.' })
              )
            })
          ],
          { description: 'Repository the function code is deployed from.' }
        )
      },
      { name: 'function', description: 'Deploy as a serverless function' }
    )
  ],
  { description: 'Source the provider runs from.' }
);

type CustomProviderFromInput = Parameters<
  typeof customProviderService.createCustomProvider
>[0]['input']['from'];

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
              branch: type.repository.branch,
              path: type.repository.path
            }
          : {
              type: 'git' as const,
              repositoryUrl: type.repository.repository_url,
              branch: type.repository.branch,
              path: type.repository.path
            }
    } satisfies CustomProviderFromInput;
  }

  throw new Error('Invalid from type');
};

export let customProviderConfigValidator = v.optional(
  v.object({
    schema: v.record(v.any(), {
      description: "JSON Schema for the provider's configuration."
    }),
    transformer: v.string({
      description: "Code that transforms the provider's configuration."
    })
  }),
  { description: 'Configuration schema and transformer for the provider.' }
);

export let customProviderController = Controller.create(
  {
    name: 'Custom Providers',
    description:
      'A custom provider is an MCP server you deploy and use through your instance. It runs from a container image, a remote URL, or serverless function code.'
  },
  {
    list: integrationsGroup
      .get(instancePath('custom-providers', 'customProviders.list'), {
        name: 'List custom providers',
        description: 'Returns a paginated list of custom providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
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
              { description: 'Only return custom providers with one of these statuses.' }
            ),
            type: v.optional(
              v.union([
                v.enumOf(['container', 'function', 'remote']),
                v.array(v.enumOf(['container', 'function', 'remote']))
              ]),
              { description: 'Only return custom providers with one of these types.' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return custom providers with one of these IDs.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return custom providers linked to one of these provider IDs (matches providers connected to sessions).'
            }),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('custom provider creation time'),
            updated_at: dateFilterValidator('custom provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderService.listCustomProviders({
          instance: ctx.instance,
          allowDeleted: false,
          search: ctx.query.search,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          status: normalizeArrayParam(ctx.query.status),
          type: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);
        let tenant = await db.tenant.findFirstOrThrow({
          where: { projectOid: ctx.project.oid }
        });

        return Paginator.present(list, customProvider =>
          subspaceCustomProviderPresenter.present({
            customProvider,
            tenant
          })
        );
      }),

    get: customProviderGroup
      .get(instancePath('custom-providers/:customProviderId', 'customProviders.get'), {
        name: 'Get custom provider',
        description: 'Retrieves a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        let tenant = await db.tenant.findFirstOrThrow({
          where: { projectOid: ctx.project.oid }
        });

        return subspaceCustomProviderPresenter.present({
          customProvider: ctx.customProvider,
          tenant
        });
      }),

    getEnv: customProviderGroup
      .get(instancePath('custom-providers/:customProviderId/env', 'customProviders.getEnv'), {
        name: 'Get custom provider environment',
        description: 'Retrieves the environment variables for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderEnvPresenter)
      .do(async ctx => {
        return subspaceCustomProviderEnvPresenter.present({
          customProviderFrom: ctx.customProvider.payload.from
        });
      }),

    create: integrationsGroup
      .post(instancePath('custom-providers', 'customProviders.create'), {
        name: 'Create custom provider',
        description: 'Creates a new custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name for the custom provider.',
            examples: ['My Custom Provider']
          }),
          description: v.optional(
            v.string({
              description: 'Free-text description.',
              examples: ['A custom MCP server for my application']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ environment: 'production' }] }),
            { description: 'Custom data to identify or organize the custom provider.' }
          ),
          from: customProviderFromValidator,
          config: customProviderConfigValidator
        })
      )
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        if (ctx.body.from.type === 'container') {
          throw new ServiceError(
            forbiddenError({ message: 'Docker MCP servers are currently disabled.' })
          );
        }

        let customProvider = await customProviderService.createCustomProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: ctx.actor!,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            from: mapCustomProviderFrom(ctx.body.from),
            config: ctx.body.config
          }
        });
        let tenant = await db.tenant.findFirstOrThrow({
          where: { projectOid: ctx.project.oid }
        });

        return subspaceCustomProviderPresenter.present({
          customProvider,
          tenant
        });
      }),

    update: customProviderGroup
      .patch(instancePath('custom-providers/:customProviderId', 'customProviders.update'), {
        name: 'Update custom provider',
        description: 'Updates a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the custom provider.',
              examples: ['Updated Provider Name']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.',
              examples: ['Updated description']
            })
          ),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'staging' }] }), {
            description: 'Custom data to identify or organize the custom provider.'
          }),
          readme: v.optional(v.string({ description: 'README content in markdown format' }))
        })
      )
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        let customProvider = await customProviderService.updateCustomProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: ctx.actor!,
          customProvider: ctx.customProvider,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            readme: ctx.body.readme
          }
        });
        let tenant = await db.tenant.findFirstOrThrow({
          where: { projectOid: ctx.project.oid }
        });

        return subspaceCustomProviderPresenter.present({
          customProvider,
          tenant
        });
      }),

    archive: customProviderGroup
      .post(
        instancePath('custom-providers/:customProviderId/archive', 'customProviders.archive'),
        {
          name: 'Archive custom provider',
          description: 'Archives a custom provider and disables new connections to it.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderPresenter)
      .do(async ctx => {
        let customProvider = await customProviderService.archiveCustomProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: ctx.actor!,
          customProvider: ctx.customProvider
        });
        let tenant = await db.tenant.findFirstOrThrow({
          where: { projectOid: ctx.project.oid }
        });

        return subspaceCustomProviderPresenter.present({
          customProvider,
          tenant
        });
      })
  }
);
