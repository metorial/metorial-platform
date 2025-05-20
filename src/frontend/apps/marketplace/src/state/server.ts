import { withSdk } from './sdk';

let fetchOpts = {
  init: {
    cache: 'force-cache' as const,
    next: process.env.NODE_ENV === 'production' ? { revalidate: 60 * 5 } : { revalidate: 0 }
  }
};

export let getServer = async (vendorSlug: string, serverSlug: string) =>
  withSdk(
    async client =>
      await client.servers[':vendorSlug'][':serverSlug'].$get(
        {
          param: {
            vendorSlug,
            serverSlug
          }
        },
        fetchOpts
      )
  );

export let listServers = async (input: {
  after?: string;
  before?: string;
  limit?: string;

  search?: string;
  collectionIds?: string[];
  categoryIds?: string[];
  profileIds?: string[];
}) =>
  withSdk(
    async client =>
      await client.servers.$get(
        {
          query: {
            ...input,
            collectionIds: input.collectionIds?.join(',') || undefined,
            categoryIds: input.categoryIds?.join(',') || undefined,
            profileIds: input.profileIds?.join(',') || undefined
          }
        },
        fetchOpts
      )
  );

export let listServerVariants = async (
  vendorSlug: string,
  serverSlug: string,
  input: {
    after?: string;
    before?: string;
    limit?: string;
  }
) =>
  withSdk(
    async client =>
      await client.servers[':vendorSlug'][':serverSlug'].variants.$get(
        {
          param: {
            vendorSlug,
            serverSlug
          },

          // @ts-ignore
          query: input
        },
        fetchOpts
      )
  );

export let listServerVersions = async (
  vendorSlug: string,
  serverSlug: string,
  input: {
    after?: string;
    before?: string;
    limit?: string;
  }
) =>
  withSdk(
    async client =>
      await client.servers[':vendorSlug'][':serverSlug'].versions.$get(
        {
          param: {
            vendorSlug,
            serverSlug
          },

          // @ts-ignore
          query: input
        },
        fetchOpts
      )
  );

export let listServerCategories = async (input: {
  after?: string;
  before?: string;
  limit?: string;
}) =>
  withSdk(async client => await client['server-categories'].$get({ query: input }, fetchOpts));

export let getServerCategory = async (categoryId: string) =>
  withSdk(
    async client =>
      await client['server-categories'][':categoryId'].$get(
        {
          param: {
            categoryId
          }
        },
        fetchOpts
      )
  );

export let listServerCollections = async (input: {
  after?: string;
  before?: string;
  limit?: string;
}) =>
  withSdk(
    async client => await client['server-collections'].$get({ query: input }, fetchOpts)
  );

export let getServerCollection = async (collectionId: string) =>
  withSdk(
    async client =>
      await client['server-collections'][':collectionId'].$get(
        {
          param: {
            collectionId
          }
        },
        fetchOpts
      )
  );

export type ServerListing = Awaited<ReturnType<typeof getServer>>;
export type ServerVersion = Awaited<ReturnType<typeof listServerVersions>>['items'][number];
export type ServerVariant = Awaited<ReturnType<typeof listServerVariants>>['items'][number];
export type ServerCategory = Awaited<ReturnType<typeof getServerCategory>>;
export type ServerCollection = Awaited<ReturnType<typeof getServerCollection>>;
