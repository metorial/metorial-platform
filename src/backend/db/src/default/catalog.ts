import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureImportedRepository = createEnsureRecord(
  db.importedRepository,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedRepository')
  })
);

export let ensureImportedServer = createEnsureRecord(
  db.importedServer,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedServer')
  })
);

export let ensureImportedServerVendor = createEnsureRecord(
  db.importedServerVendor,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('importedServerVendor')
  })
);

export let ensureServerListingCategory = createEnsureRecord(
  db.serverListingCategory,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListingCategory')
  })
);

export let ensureServerListingCollection = createEnsureRecord(
  db.serverListingCollection,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListingCollection')
  })
);

export let ensureServerListing = createEnsureRecord(
  db.serverListing,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('serverListing')
  })
);

export let ensureServerVariantProvider = createEnsureRecord(
  db.serverVariantProvider,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('serverVariantProvider')
  })
);

export let ensureServerVariant = createEnsureRecord(
  db.serverVariant,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('serverVariant')
  })
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
  })
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
  })
);
