import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';
import { checkObjectMatch } from '../lib/objectMatch';

export let ensureImportedRepository = createEnsureRecord(
  db.importedRepository,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedRepository')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )([
        'identifier',
        'slug',
        'name',
        'providerUrl',
        'websiteUrl',
        'provider',
        'providerId',
        'providerFullIdentifier',
        'providerIdentifier',
        'providerOwnerId',
        'providerOwnerIdentifier',
        'providerOwnerUrl',
        'isFork',
        'isArchived',
        'starCount',
        'forkCount',
        'watcherCount',
        'openIssuesCount',
        'subscriptionCount',
        'size',
        'defaultBranch',
        'licenseName',
        'licenseUrl',
        'licenseSpdxId',
        'topics',
        'language',
        'description',
        'createdAt',
        'updatedAt',
        'pushedAt'
      ])
  }
);

export let ensureImportedServer = createEnsureRecord(
  db.importedServer,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedServer')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )([
        'fullSlug',
        'slug',
        'name',
        'description',
        'subdirectory',
        'isOfficial',
        'isCommunity',
        'isHostable',
        'readme',
        'attributes',
        'createdAt',
        'updatedAt'
      ])
  }
);

export let ensureImportedServerVendor = createEnsureRecord(
  db.importedServerVendor,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedServerVendor')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(a, b)(['identifier', 'name', 'description', 'createdAt', 'updatedAt'])
  }
);

export let ensureServerListingCategory = createEnsureRecord(
  db.serverListingCategory,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListingCategory')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(a, b)(['slug', 'name', 'description', 'createdAt', 'updatedAt'])
  }
);

export let ensureServerListingCollection = createEnsureRecord(
  db.serverListingCollection,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListingCollection')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(a, b)(['slug', 'name', 'description', 'createdAt', 'updatedAt'])
  }
);

export let ensureServerListing = createEnsureRecord(
  db.serverListing,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListing')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )([
        'status',
        'name',
        'slug',
        'description',
        'readme',
        'rank',
        'skills',
        'deploymentsCount',
        'repoStarsCount',
        'serverSessionsCount',
        'serverMessagesCount',
        'createdAt',
        'updatedAt',
        'rankUpdatedAt'
      ])
  }
);

export let ensureServerVariantProvider = createEnsureRecord(
  db.serverVariantProvider,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('serverVariantProvider')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )(['identifier', 'name', 'description', 'attributes', 'createdAt', 'updatedAt'])
  }
);

export let ensureServerVariant = createEnsureRecord(
  db.serverVariant,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('serverVariant')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )([
        'identifier',
        'sourceType',
        'dockerImage',
        'remoteUrl',
        'mcpVersion',
        'remoteServerProtocol',
        'createdAt'
      ])
  }
);

export let ensureServerVersion = createEnsureRecord(
  db.serverVersion,
  d => ({
    identifier_serverVariantOid: {
      identifier: d.identifier,
      serverVariantOid: d.serverVariantOid!
    }
  }),
  async () => ({
    id: await ID.generateId('serverVersion')
  }),
  {
    checkMatch: (a, b) =>
      checkObjectMatch(
        a,
        b
      )([
        'identifier',
        'getLaunchParams',
        'sourceType',
        'dockerImage',
        'dockerTag',
        'remoteUrl',
        'mcpVersion',
        'remoteServerProtocol',
        'createdAt'
      ])
  }
);

export let ensureServerConfig = createEnsureRecord(
  db.serverConfigSchema,
  d => ({
    fingerprint_serverOid: {
      fingerprint: d.fingerprint,
      serverOid: d.serverOid!
    }
  }),
  async () => ({
    id: await ID.generateId('serverConfigSchema')
  }),
  {
    checkMatch: (a, b) => checkObjectMatch(a, b)(['fingerprint'])
  }
);
