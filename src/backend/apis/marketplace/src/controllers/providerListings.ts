import { createHono } from '@metorial/hono';
import { notFoundError, ServiceError } from '@metorial/error';
import {
  subspacePublicProviderListingService,
  subspacePublicProviderToolService,
  subspacePublicProviderVersionService,
  type SubspaceProviderToolListItem
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { toPaginationQuery } from '../lib/paginationQuery';
import { paginatorSchema } from '../lib/paginatorSchema';
import { presentProviderListing } from '../presenters/provider';
import { useValidation } from '../lib/validator';

let normalizeSlug = (slug: string) => slug.replaceAll('---', '/').toLowerCase();
let stringToBoolean = (str: string | undefined) => {
  if (!str) return undefined;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
};
let splitCsv = (value: string | undefined) =>
  value
    ?.split(',')
    .map(v => v.trim())
    .filter(Boolean);

type ListResponse<T> = {
  __typename: 'list';
  items: T[];
  pagination: {
    has_more_after: false;
    has_more_before: false;
  };
};
let toList = <T>(items: T[] = []): ListResponse<T> => ({
  __typename: 'list',
  items,
  pagination: {
    has_more_after: false,
    has_more_before: false
  }
});

let getPublicProviderListingBySlug = async (d: { slug: string }) =>
  await subspacePublicProviderListingService.get({
    providerListingId: normalizeSlug(d.slug)
  });

type SubspacePublicPaginator<T> = {
  run: (query: { limit?: number; after?: string }) => Promise<{
    items: T[];
    pagination: { hasNextPage: boolean };
  }>;
};
let listAllPaginatorItems = async <T extends { id: string }>(
  paginator: SubspacePublicPaginator<T>
) => {
  let items: T[] = [];
  let after: string | undefined = undefined;
  let seen = new Set<string>();

  while (true) {
    let page = await paginator.run({ limit: 100, after });
    items.push(...page.items);

    if (!page.pagination.hasNextPage) break;

    let nextAfter = page.items[page.items.length - 1]?.id;
    if (!nextAfter || seen.has(nextAfter)) break;

    seen.add(nextAfter);
    after = nextAfter;
  }

  return items;
};

let listAllProviderTools = async (d: { providerVersion: string }) =>
  await listAllPaginatorItems<SubspaceProviderToolListItem>(
    await subspacePublicProviderToolService.list({
      providerVersion: d.providerVersion
    })
  );

let listProviderVariantsForListing = (
  listing: Awaited<ReturnType<typeof subspacePublicProviderListingService.get>>
) => {
  let defaultVariant = listing.provider?.defaultVariant;
  return defaultVariant ? [defaultVariant] : [];
};

let throwNotFound = () => {
  throw new ServiceError(notFoundError('endpoint', null));
};

export let providerListingsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          search: z.optional(z.string()),
          collectionIds: z.optional(z.string()),
          categoryIds: z.optional(z.string()),
          profileIds: z.optional(z.string()),
          isVerified: z.optional(z.string()),
          isOfficial: z.optional(z.string()),
          isMetorial: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.valid('query');

      let paginator = await subspacePublicProviderListingService.list({
        search: query.search,
        providerCollectionIds: splitCsv(query.collectionIds),
        providerCategoryIds: splitCsv(query.categoryIds),
        publisherIds: splitCsv(query.profileIds),
        isMetorial: stringToBoolean(query.isMetorial),
        isOfficial: stringToBoolean(query.isOfficial),
        isVerified: stringToBoolean(query.isVerified),
        isPublic: true,
        orderByRank: true
      });

      let list = await paginator.run(toPaginationQuery(query));

      return c.json(
        await Paginator.presentLight(list, provider => presentProviderListing(provider))
      );
    }
  )
  .get(':slug', async c => {
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    return c.json(presentProviderListing(listing));
  })
  .get(':slug/capabilities', async c => {
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    let providerVersion =
      listing.provider?.currentVersion?.id ??
      listing.provider?.defaultVariant?.currentVersion?.id;
    if (!providerVersion) return c.json(toList());

    let tools = await listAllProviderTools({ providerVersion });
    return c.json(toList(tools));
  })
  .get(':slug/variants', async c => {
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    let variants = listProviderVariantsForListing(listing);
    return c.json(toList(variants));
  })
  .get(':slug/variants/:variantId', async c => {
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    let variants = listProviderVariantsForListing(listing);
    let variant = variants.find(v => v.id === c.req.param('variantId'));
    if (!variant) throwNotFound();

    return c.json(variant);
  })
  .get(':slug/versions', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    let providerId = listing.provider?.id;
    if (!providerId) return c.json(toList());

    let paginator = await subspacePublicProviderVersionService.list({
      providerIds: [providerId]
    });
    let list = await paginator.run(toPaginationQuery(query));

    return c.json(await Paginator.presentLight(list, version => version));
  })
  .get(':slug/versions/:versionId', async c => {
    let listing = await getPublicProviderListingBySlug({ slug: c.req.param('slug') });
    if (!listing) throwNotFound();

    let providerId = listing.provider?.id;
    if (!providerId) throwNotFound();

    let paginator = await subspacePublicProviderVersionService.list({
      providerIds: [providerId],
      ids: [c.req.param('versionId')]
    });
    let list = await paginator.run({ limit: 1 });
    let version = list.items[0];
    if (!version) throwNotFound();

    return c.json(version);
  });
