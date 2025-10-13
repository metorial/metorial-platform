import { getImageUrl } from '@metorial/db';
import { markdownService } from '@metorial/module-markdown';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingType } from '../types';
import { v1ProfilePresenter } from './profile';
import { v1ServerListingCategoryPresenter } from './serverCategory';
import { v1ServerPreview } from './serverPreview';

export let v1ServerListingPresenter = Presenter.create(serverListingType)
  .presenter(async ({ serverListing, readme }, opts) => {
    let vendor = serverListing.server.importedServer?.vendor;
    let repository = serverListing.server.importedServer?.repository;

    return {
      object: 'server_listing',

      id: serverListing.id,
      status: serverListing.status,

      slug: serverListing.slug,
      name: serverListing.name,
      description: serverListing.description,
      readme: readme ?? null,

      skills: serverListing.skills,

      image_url: await getImageUrl(
        !serverListing.image || serverListing.image?.type == 'default'
          ? (vendor ?? serverListing.profile ?? serverListing)
          : serverListing
      ),

      profile: serverListing.profile
        ? await v1ProfilePresenter.present({ profile: serverListing.profile }, opts).run()
        : null,

      server: v1ServerPreview(serverListing.server),

      categories: await Promise.all(
        serverListing.categories.map(category =>
          v1ServerListingCategoryPresenter.present({ category }, opts).run()
        )
      ),

      is_official:
        serverListing.isOfficial || !!serverListing.server.importedServer?.isOfficial,
      is_community: !!serverListing.server.importedServer?.isCommunity,
      is_hostable: !!serverListing.server.importedServer?.isHostable,

      is_metorial: serverListing.isMetorial,
      is_verified: serverListing.isVerified,

      vendor: vendor
        ? ({
            id: vendor.id,
            identifier: vendor.identifier,
            name: vendor.name,
            description: vendor.description,

            image_url: await getImageUrl(vendor),

            attributes: vendor.attributes,

            created_at: vendor.createdAt,
            updated_at: vendor.updatedAt
          } as any)
        : null,

      repository: repository
        ? ({
            id: repository.id,
            identifier: repository.identifier,
            slug: repository.slug,
            name: repository.name,
            provider_url: repository.providerUrl,
            website_url: repository.websiteUrl,
            provider: repository.provider,

            star_count: repository.starCount,
            fork_count: repository.forkCount,
            watcher_count: repository.watcherCount,
            open_issues_count: repository.openIssuesCount,
            subscription_count: repository.subscriptionCount,

            default_branch: repository.defaultBranch,

            license_name: repository.licenseName,
            license_url: repository.licenseUrl,
            license_spdx_id: repository.licenseSpdxId,

            topics:
              typeof repository.topics == 'string'
                ? JSON.parse(repository.topics)
                : repository.topics,

            language: repository.language,
            description: repository.description,

            created_at: repository.createdAt,
            updated_at: repository.updatedAt,
            pushed_at: repository.pushedAt
          } as any)
        : null,

      installation: serverListing.server.instanceServers?.length
        ? {
            id: serverListing.server.instanceServers[0].id,
            created_at: serverListing.server.instanceServers[0].createdAt,
            instance_id: serverListing.server.instanceServers[0].instance.id
          }
        : null,

      created_at: serverListing.createdAt,
      updated_at: serverListing.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('server_listing'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server listing'
      }),

      status: v.enumOf(['active', 'archived', 'banned'], {
        name: 'status',
        description: 'The current status of the server listing'
      }),

      slug: v.string({
        name: 'slug',
        description: 'A URL-friendly unique string identifier for the listing'
      }),

      image_url: v.string({
        name: 'image_url',
        description: 'URL to the image representing the server listing'
      }),

      profile: v.nullable(v1ProfilePresenter.schema),

      name: v.string({
        name: 'name',
        description: 'The name of the server listing'
      }),

      description: v.string({
        name: 'description',
        description: 'A detailed description of the server listing'
      }),

      readme: v.string({
        name: 'readme',
        description: 'README content or notes related to the server listing'
      }),

      categories: v.array(v1ServerListingCategoryPresenter.schema, {
        name: 'categories',
        description: 'Categories associated with the server listing'
      }),

      skills: v.array(v.string(), {
        name: 'skills',
        description: 'List of skills relevant to the server listing'
      }),

      is_official: v.boolean({
        name: 'is_official',
        description: 'Indicates if the listing is officially recognized'
      }),

      is_community: v.boolean({
        name: 'is_community',
        description: 'Indicates if the listing is community contributed'
      }),

      is_hostable: v.boolean({
        name: 'is_hostable',
        description: 'Indicates if the listing can be hosted'
      }),

      is_metorial: v.boolean({
        name: 'is_metorial',
        description: 'True if this listing is managed directly by Metorial'
      }),

      is_verified: v.boolean({
        name: 'is_verified',
        description: 'Indicates whether the listing has been verified for authenticity'
      }),

      server: v1ServerPreview.schema,

      vendor: v.nullable(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'Unique identifier of the vendor'
            }),
            identifier: v.string({
              name: 'identifier',
              description: 'Vendor unique identifier string'
            }),
            name: v.string({
              name: 'name',
              description: 'Vendor name'
            }),
            description: v.nullable(
              v.string({
                name: 'description',
                description: 'Description of the vendor'
              })
            ),

            image_url: v.string({
              name: 'image_url',
              description: 'URL to the vendor image'
            }),

            attributes: v.optional(v.any()),

            created_at: v.date({
              name: 'created_at',
              description: 'Vendor creation timestamp'
            }),
            updated_at: v.date({
              name: 'updated_at',
              description: 'Vendor last update timestamp'
            })
          },
          {
            name: 'vendor',
            description: 'Information about the vendor, if any'
          }
        )
      ),

      repository: v.nullable(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'Repository unique identifier'
            }),
            identifier: v.string({
              name: 'identifier',
              description: 'Repository identifier string'
            }),
            slug: v.string({
              name: 'slug',
              description: 'Repository slug'
            }),
            name: v.string({
              name: 'name',
              description: 'Repository name'
            }),
            provider_url: v.string({
              name: 'provider_url',
              description: 'URL of the repository provider'
            }),
            website_url: v.string({
              name: 'website_url',
              description: 'Repository website URL'
            }),
            provider: v.string({
              name: 'provider',
              description: 'Repository provider name'
            }),

            star_count: v.number({
              name: 'star_count',
              description: 'Number of stars on the repository'
            }),
            fork_count: v.number({
              name: 'fork_count',
              description: 'Number of forks on the repository'
            }),
            watcher_count: v.number({
              name: 'watcher_count',
              description: 'Number of watchers on the repository'
            }),
            open_issues_count: v.number({
              name: 'open_issues_count',
              description: 'Number of open issues'
            }),
            subscription_count: v.number({
              name: 'subscription_count',
              description: 'Number of subscriptions'
            }),

            default_branch: v.string({
              name: 'default_branch',
              description: 'Default branch name of the repository'
            }),

            license_name: v.string({
              name: 'license_name',
              description: 'Name of the license'
            }),
            license_url: v.string({
              name: 'license_url',
              description: 'URL of the license'
            }),
            license_spdx_id: v.string({
              name: 'license_spdx_id',
              description: 'SPDX license identifier'
            }),

            topics: v.array(v.string(), {
              name: 'topics',
              description: 'List of topics associated with the repository'
            }),

            language: v.nullable(
              v.string({
                name: 'language',
                description: 'Primary programming language of the repository'
              })
            ),
            description: v.nullable(
              v.string({
                name: 'description',
                description: 'Repository description'
              })
            ),

            created_at: v.date({
              name: 'created_at',
              description: 'Repository creation timestamp'
            }),
            updated_at: v.date({
              name: 'updated_at',
              description: 'Repository last update timestamp'
            }),
            pushed_at: v.nullable(
              v.date({
                name: 'pushed_at',
                description: 'Timestamp of last push to the repository'
              })
            )
          },
          {
            name: 'repository',
            description: 'Repository details, if any'
          }
        )
      ),

      installation: v.nullable(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'Installation unique identifier'
            }),
            instance_id: v.string({
              name: 'instance_id',
              description: 'Instance identifier associated with the installation'
            }),
            created_at: v.date({
              name: 'created_at',
              description: 'Installation creation timestamp'
            })
          },
          {
            name: 'installation',
            description: 'Installation details, if any'
          }
        )
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Server listing creation timestamp'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Server listing last update timestamp'
      })
    })
  )
  .build();

export let dashboardServerListingPresenter = Presenter.create(serverListingType)
  .presenter(async ({ serverListing, readme }, opts) => {
    let v1 = await v1ServerListingPresenter
      .present(
        {
          serverListing,
          readme
        },
        opts
      )
      .run();

    let repository = serverListing.server.importedServer?.repository;

    return {
      ...v1,

      oauth_explainer: serverListing.oauthExplainer,

      fork: serverListing.server.customServer?.isForkable
        ? {
            status: 'enabled',
            template_id: serverListing.server.customServer.forkTemplateManagedServer?.id!
          }
        : {
            status: 'disabled'
          },

      readme_html: readme
        ? await markdownService.renderMarkdown({
            markdown: readme,
            id: serverListing.id,
            imageRoot: repository
              ? `https://raw.githubusercontent.com/${repository.identifier.replace('github.com/', '')}/refs/heads/${repository.defaultBranch ?? 'main'}`
              : 'https://metorial.com',
            linkRoot: repository
              ? `https://github.com/${repository.identifier.replace('github.com/', '')}/blob/${repository.defaultBranch ?? 'main'}`
              : 'https://metorial.com'
            // rootPath: serverListing.server.importedServer?.subdirectory ?? undefined
          })
        : null
    };
  })
  .schema(
    v.intersection([
      v1ServerListingPresenter.schema,
      v.object({
        fork: v.union([
          v.object({
            status: v.literal('disabled', {
              name: 'status',
              description: 'Indicates if forking is enabled for this server listing'
            })
          }),
          v.object({
            status: v.literal('enabled', {
              name: 'status',
              description: 'Indicates if forking is enabled for this server listing'
            }),
            template_id: v.string({
              name: 'template_id',
              description:
                'The ID of the managed server template created when this listing is forked'
            })
          })
        ]),

        oauth_explainer: v.nullable(
          v.string({
            name: 'oauth_explainer',
            description: 'Explainer text for OAuth setup, if applicable'
          })
        ),

        readme_html: v.nullable(
          v.string({
            name: 'readme_html',
            description: 'HTML-rendered version of the server listing README'
          })
        )
      })
    ]) as any
  )
  .build();
