import type {
  ClientCapabilities,
  JSONRPCMessage,
  Prompt,
  ResourceTemplate,
  ServerCapabilities,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema';
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
