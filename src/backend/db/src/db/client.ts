import type {
  ClientCapabilities,
  JSONRPCMessage,
  Prompt,
  ResourceTemplate,
  ServerCapabilities,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema';
import { Worker as SnowflakeId } from 'snowflake-uuid';
import { PrismaClient } from '../../prisma/generated';
import { EntityImage as ImportedEntityImage } from '../lib';
export * from '../../prisma/generated';

let workerIdBits = 10;
let workerIdMask = (1 << workerIdBits) - 1;

let workerId = (() => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0] & workerIdMask; // Mask to get only the lowest 10 bits
})();

let generator = new SnowflakeId(workerId, 0, {
  workerIdBits: workerIdBits,
  datacenterIdBits: 3,
  sequenceBits: 12,
  epoch: new Date('2025-01-01T00:00:00Z').getTime()
});

let createClient = () => {
  let baseClient = new PrismaClient({});

  return baseClient.$extends({
    query: {
      $allModels: {
        create: async args => {
          let normalizedModelName = (args.model.charAt(0).toUpperCase() +
            args.model.slice(1)) as 'user';

          if (baseClient[normalizedModelName].fields.oid?.typeName == 'BigInt') {
            // @ts-ignore
            args.args.data.oid = generator.nextId();
          }

          return args.query(args.args);
        },

        createMany: async args => {
          let normalizedModelName = (args.model.charAt(0).toUpperCase() +
            args.model.slice(1)) as 'user';

          if (baseClient[normalizedModelName].fields.oid?.typeName == 'BigInt') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.oid = generator.nextId();
            }
          }

          return args.query(args.args);
        },

        createManyAndReturn: async args => {
          let normalizedModelName = (args.model.charAt(0).toUpperCase() +
            args.model.slice(1)) as 'user';

          if (baseClient[normalizedModelName].fields.oid?.typeName == 'BigInt') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.oid = generator.nextId();
            }
          }

          return args.query(args.args);
        },

        upsert: async args => {
          let normalizedModelName = (args.model.charAt(0).toUpperCase() +
            args.model.slice(1)) as 'user';

          if (baseClient[normalizedModelName].fields.oid?.typeName == 'BigInt') {
            // @ts-ignore
            args.args.create.oid = generator.nextId();
          }

          return args.query(args.args);
        }
      }
    }
  }) as PrismaClient;
};

let db: PrismaClient = createClient();

export { db };

export type DB = typeof db;

declare global {
  namespace PrismaJson {
    type Record = { [key: string]: any };

    type EntityImage = ImportedEntityImage;

    type ServerEntityAttributes = {
      websiteUrl?: string;
    };

    type ServerConfigSchema = JSONSchema4 | JSONSchema6 | JSONSchema7;

    type ServerVersionTools = Tool[] | null;
    type ServerVersionPrompts = Prompt[] | null;
    type ServerVersionResourceTemplates = ResourceTemplate[] | null;
    type ServerVersionServerInfo = { name: string; version: string } | null;
    type ServerVersionServerCapabilities = ServerCapabilities | null;

    type SessionClientInfo = { name: string; version: string };
    type SessionClientCapabilities = ClientCapabilities;
    type SessionServerInfo = { name: string; version: string };
    type SessionServerCapabilities = ServerCapabilities;

    type SessionMessageMcpPayload = JSONRPCMessage;
  }
}
