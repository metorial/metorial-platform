import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingType } from '../types';
import { v1ServerListingCategoryPresenter } from './serverCategory';

export let v1ServerListingPresenter = Presenter.create(serverListingType)
  .presenter(async ({ serverListing }, opts) => {
    let vendor = serverListing.server.importedServer?.vendor;
    let repository = serverListing.server.importedServer?.repository;

    return {
      object: 'server_listing',

      id: serverListing.id,
      status: serverListing.status,

      slug: serverListing.slug,
      name: serverListing.name,
      description: serverListing.description,
      readme: serverListing.readme,

      skills: serverListing.skills,

      server_id: serverListing.server.id,

      categories: await Promise.all(
        serverListing.categories.map(category =>
          v1ServerListingCategoryPresenter.present({ category }, opts).run()
        )
      ),

      is_official: !!serverListing.server.importedServer?.isOfficial,
      is_community: !!serverListing.server.importedServer?.isCommunity,
      is_hostable: !!serverListing.server.importedServer?.isHostable,

      vendor: vendor
        ? ({
            id: vendor.id,
            identifier: vendor.identifier,
            name: vendor.name,
            description: vendor.description,

            image_url: getImageUrl(vendor),

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

            topics: repository.topics,

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

      id: v.string(),
      status: v.enumOf(['active', 'archived', 'banned']),

      slug: v.string(),
      name: v.string(),
      description: v.string(),
      readme: v.string(),
      server_id: v.string(),
      categories: v.array(v1ServerListingCategoryPresenter.schema),
      skills: v.array(v.string()),

      is_official: v.boolean(),
      is_community: v.boolean(),
      is_hostable: v.boolean(),

      vendor: v.nullable(
        v.object({
          id: v.string(),
          identifier: v.string(),
          name: v.string(),
          description: v.nullable(v.string()),

          image_url: v.string(),

          attributes: v.optional(v.any()),

          created_at: v.date(),
          updated_at: v.date()
        })
      ),

      repository: v.nullable(
        v.object({
          id: v.string(),
          identifier: v.string(),
          slug: v.string(),
          name: v.string(),
          provider_url: v.string(),
          website_url: v.string(),
          provider: v.string(),

          star_count: v.number(),
          fork_count: v.number(),
          watcher_count: v.number(),
          open_issues_count: v.number(),
          subscription_count: v.number(),

          default_branch: v.string(),

          license_name: v.string(),
          license_url: v.string(),
          license_spdx_id: v.string(),

          topics: v.array(v.string()),

          language: v.nullable(v.string()),
          description: v.nullable(v.string()),

          created_at: v.date(),
          updated_at: v.date(),
          pushed_at: v.nullable(v.date())
        })
      ),

      installation: v.nullable(
        v.object({
          id: v.string(),
          instance_id: v.string(),
          created_at: v.date()
        })
      ),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
