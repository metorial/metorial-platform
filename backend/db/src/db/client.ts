import { PrismaClient } from '../../prisma/generated';
export * from '../../prisma/generated';

let createClient = () => new PrismaClient({});

let db: PrismaClient = createClient();

export { db };

export type DB = typeof db;

declare global {
  namespace PrismaJson {
    type AuditLogTarget = {
      id: string;
      name: string;
      slug?: string;
    };

    type AuditLogPayload = {
      [key: string]: any;
    };

    type Record = { [key: string]: any };

    type OrganizationNotificationPayload = { [key: string]: any };

    type OrganizationNotificationActions = {
      variant?: 'primary' | 'secondary';
      text: string;
      action: {
        type: 'navigate';
        path: string;
      };
    }[];

    type OrganizationUserConfigValue = { [key: string]: any };

    type EntityImage =
      | { type: 'file'; fileId: string; fileLinkId: string; url: string }
      | { type: 'default' };
  }
}
