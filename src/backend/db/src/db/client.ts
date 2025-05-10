import { PrismaClient } from '../../prisma/generated';
export * from '../../prisma/generated';

let createClient = () => new PrismaClient({});

let db: PrismaClient = createClient();

export { db };

export type DB = typeof db;

declare global {
  namespace PrismaJson {
    type Record = { [key: string]: any };

    type OrganizationUserConfigValue = { [key: string]: any };

    type EntityImage =
      | { type: 'file'; fileId: string; fileLinkId: string; url: string }
      | { type: 'url'; url: string }
      | { type: 'default' };
  }
}
