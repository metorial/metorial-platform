import { Snowflake } from '@lowerdeck/snowflake';
import type {
  ClientCapabilities,
  JSONRPCMessage,
  Prompt,
  ResourceTemplate,
  ServerCapabilities,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { ModelMessage } from 'ai';
import type { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema';
import { PrismaClient } from '../../prisma/generated/client.js';
export * from '../../prisma/generated/client.js';

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;

let workerId = (() => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0] & workerIdMask;
})();

let generator = new Snowflake({
  workerId,
  datacenterId: 0,
  workerIdBits: workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z')
});

let getSecureRandomInt = () => {
  let array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] & 0x7fffffff;
};

let createClient = () => {
  let mainAdapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
  });

  let replicaAdapter = process.env.DATABASE_URL_READER
    ? new PrismaPg({
        connectionString: process.env.DATABASE_URL_READER
      })
    : undefined;

  let replicaClient = replicaAdapter
    ? new PrismaClient({ adapter: replicaAdapter })
    : undefined;

  let baseClient = new PrismaClient({
    adapter: mainAdapter,
    transactionOptions: {
      maxWait: 10000,
      timeout: 12000
    }
  });

  if (replicaClient) {
    baseClient = baseClient.$extends(
      readReplicas({ replicas: [replicaClient] })
    ) as any as PrismaClient;
  }

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

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'BigInt') {
            // @ts-ignore
            args.args.data.id = generator.nextId();
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.oid?.typeName == 'Int') {
            // @ts-ignore
            args.args.data.oid = getSecureRandomInt();
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'Int') {
            // @ts-ignore
            args.args.data.id = getSecureRandomInt();
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

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'BigInt') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.id = generator.nextId();
            }
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.oid?.typeName == 'Int') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.oid = getSecureRandomInt();
            }
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'Int') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.id = getSecureRandomInt();
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

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'BigInt') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.id = generator.nextId();
            }
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.oid?.typeName == 'Int') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.oid = getSecureRandomInt();
            }
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'Int') {
            let data = Array.isArray(args.args.data) ? args.args.data : [args.args.data];

            for (let item of data) {
              // @ts-ignore
              item.id = getSecureRandomInt();
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

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'BigInt') {
            // @ts-ignore
            args.args.create.id = generator.nextId();
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.oid?.typeName == 'Int') {
            // @ts-ignore
            args.args.create.oid = getSecureRandomInt();
          }

          // @ts-ignore
          if (baseClient[normalizedModelName].fields.id?.typeName == 'Int') {
            // @ts-ignore
            args.args.create.id = getSecureRandomInt();
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

    type ServerEntityAttributes = {
      websiteUrl?: string;
    };

    type ServerConfigSchema = JSONSchema4 | JSONSchema6 | JSONSchema7;

    type ServerVersionTools = Tool[] | null;
    type ServerVersionPrompts = Prompt[] | null;
    type ServerVersionResourceTemplates = ResourceTemplate[] | null;
    type ServerVersionServerInfo = { name: string; version: string } | null;
    type ServerVersionServerCapabilities = ServerCapabilities | null;
    type ServerVersionServerInstructions = string | null;

    type SessionClientInfo = { name: string; version: string };
    type SessionClientCapabilities = ClientCapabilities;
    type SessionServerInfo = { name: string; version: string };
    type SessionServerCapabilities = ServerCapabilities;

    type SessionMessageMcpPayload = JSONRPCMessage;

    type ProviderOAuthConfigTemplateVariables = {
      type: 'string';
      label: string;
      key: string;
      description?: string;
      isRequired?: boolean;
    }[];
    type ProviderOAuthConfigTemplateScopes = {
      identifier: string;
      description: string;
    }[];

    type ProviderOAuthConfig = any;

    type CustomServerDeploymentStepLogs = (
      | [number, string[], 0 | 1 | undefined]
      | [number, string[], 0 | 1]
    )[]; // ts, lines, 1=error

    type CodeBucketTemplateContents = {
      path: string;
      content: string;
    }[];

    type Headers = [string, string][];

    type PolicyDocument = {
      access: {
        target: string;
        scopes?: string[];
        roles?: string[];
      }[];
    };

    type PortalAllowedRedirectUrlFilters = {
      url: string;
    }[];

    type AssistantRunCost = {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;

      inputCost: number;
      outputCost: number;
      totalCost: number;
    };

    type AssistantRunMetadata = { [key: string]: any };

    type AssistantMessageStateContent = any;

    type AssistantMessageSerializedContent = {
      b: 'ai-sdk-1';
      messages: [number, ModelMessage][]; // TS + AI SDK messages
    };
  }
}
