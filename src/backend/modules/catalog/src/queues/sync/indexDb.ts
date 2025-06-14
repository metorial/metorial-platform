import { Database } from 'bun:sqlite';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import {
  IndexCategory,
  IndexRepository,
  IndexServer,
  IndexServerProvider,
  IndexServerVariant,
  IndexServerVersion,
  IndexVendor
} from './types';

let CURRENT_INDEX_DB_URL =
  'https://github.com/metorial/mcp-index/releases/download/latest/index.db';

export class IndexDB {
  private constructor(
    private readonly db: Database,
    private readonly dir: string
  ) {}

  static async create() {
    let dir = path.join(os.tmpdir(), 'metorial', 'catalog-sync', Date.now().toString());
    await fs.ensureDir(dir);

    let dbPath = path.join(dir, 'index.db');
    let res = await fetch(CURRENT_INDEX_DB_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch index database: ${res.status} ${res.statusText}`);
    }

    let nodeReadable = Readable.fromWeb(res.body as any);
    let fileStream = fs.createWriteStream(dbPath);

    await new Promise<void>((resolve, reject) =>
      nodeReadable.pipe(fileStream).on('finish', resolve).on('error', reject)
    );

    let indexDb = new Database(dbPath, { readonly: true });

    return new IndexDB(indexDb, dir);
  }

  get vendors() {
    return {
      iterate: () =>
        this.db.query<IndexVendor, any>('SELECT * FROM PublicServerVendor').iterate()
    };
  }

  get categories() {
    return {
      iterate: () =>
        this.db.query<IndexCategory, any>('SELECT * FROM PublicServerCategory').iterate()
    };
  }

  get serverProviders() {
    return {
      iterate: () =>
        this.db.query<IndexServerProvider, any>('SELECT * FROM PublicServerProvider').iterate()
    };
  }

  get repositories() {
    return {
      iterate: () =>
        this.db.query<IndexRepository, any>('SELECT * FROM PublicRepository').iterate()
    };
  }

  get servers() {
    return {
      iterate: () => this.db.query<IndexServer, any>('SELECT * FROM PublicServer').iterate(),

      variants: (server: { identifier: string }) =>
        this.db
          .query<
            {
              identifier: string;
              sourceType: 'docker' | 'remote';
              providerIdentifier: string;
              dockerImage: string | null;
              remoteUrl: string | null;
            },
            any
          >('SELECT * FROM PublicServerVariant WHERE serverIdentifier = ?')
          .all(server.identifier),

      categoryIdentifiers: (server: { identifier: string }) =>
        this.db
          .query<
            {
              B: string;
            },
            any
          >('SELECT * FROM _PublicServerToPublicServerCategory WHERE A = ?')
          .all(server.identifier)
    };
  }

  get serverVariants() {
    return {
      iterate: () =>
        this.db.query<IndexServerVariant, any>('SELECT * FROM PublicServerVariant').iterate(),

      versions: (variant: { identifier: string }) =>
        this.db
          .query<
            IndexServerVersion,
            any
          >('SELECT * FROM PublicServerVariantVersion WHERE variantIdentifier = ?')
          .all(variant.identifier)
    };
  }

  get serverVersions() {
    return {
      iterate: () =>
        this.db
          .query<IndexServerVersion, any>('SELECT * FROM PublicServerVariantVersion')
          .iterate()
    };
  }

  async close() {
    await this.db.close();
    await fs.remove(this.dir);
  }
}
