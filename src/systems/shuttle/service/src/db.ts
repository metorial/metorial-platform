import type {
  InitializeRequest,
  InitializeResult,
  McpError,
  Prompt,
  ResourceTemplate,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { PrismaClient } from '../prisma/generated/client';

let mainAdapter = new PrismaPg({
  connectionString: process.env.SHUTTLE_DATABASE_URL ?? process.env.DATABASE_URL
});

let replicaAdapter = process.env.DATABASE_URL_READER
  ? new PrismaPg({
      connectionString: process.env.DATABASE_URL_READER
    })
  : undefined;

let replicaClient = replicaAdapter ? new PrismaClient({ adapter: replicaAdapter }) : undefined;

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

export let db = baseClient;

declare global {
  namespace PrismaJson {
    type ServerConnectionClient = InitializeRequest['params']['clientInfo'];
    type ServerConnectionCapabilities = InitializeRequest['params']['capabilities'];

    type OutputType = 'stdout' | 'stderr' | 'debug.info' | 'debug.warning' | 'debug.error';
    type ServerConnectionLogLines = [number, number, string[]][]; // ts, outputType, lines[]

    type ServerSpecificationValue = {
      capabilities: InitializeResult['capabilities'];
      info: InitializeResult['serverInfo'];
      instructions: InitializeResult['instructions'];
      prompts: Prompt[];
      tools: Tool[];
      resourceTemplates: ResourceTemplate[];
    };

    type RemoteOAuthConfigTemplateVariables = {
      type: 'string';
      label: string;
      key: string;
      description?: string;
      isRequired?: boolean;
    }[];
    type RemoteOAuthConfigTemplateScopes = {
      identifier: string;
      description: string;
    }[];

    type RemoteOAuthConfig = any;

    type NetworkingRulesetList = {
      v: 1;
      defaultAction: 'accept' | 'deny';
      rules: {
        action: 'accept' | 'deny';
        protocol?: 'tcp' | 'udp' | 'icmp';
        destination?: string;
        portRange?: { start: number; end: number };
      }[];
    };

    type FunctionServerProviderDeploymentInfo = {
      functionId: string;
      functionVersionId?: string;
      functionDeploymentId: string;
    } | null;

    type UpcomingFunctionServerPayload = {
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
    };

    type ServerDeploymentStepLogs = [number, string][];

    type FunctionServerInvocationLogs = { timestamp: number; message: string }[];

    type ServerConfigSchema = Record<string, any> | null;

    type FunctionServerConfigSchema = Record<string, any> | null;
    type FunctionServerAuthConfigSchema = Record<string, any> | null;

    type RemoteOAuthAutoRegistrationData = Record<string, any>;

    type DelegatedOAuthConnectionAuthConfig = Record<string, any>;
    type DelegatedOAuthConnectionAuthState = Record<string, any>;
    type ServerOAuthSetupAuthConfig = Record<string, any>;

    type FunctionServerInfo = {
      info: InitializeResult['serverInfo'];
      capabilities: InitializeResult['capabilities'];
      instructions?: InitializeResult['instructions'];
    };

    type ServerDiscoveryError =
      | {
          type: 'mcp_error';
          error: {
            code: McpError['code'];
            message: McpError['message'];
            data?: McpError['data'];
          };
        }
      | {
          type: 'connection_error';
          error: {
            code: string;
            message?: string;
          };
        }
      | {
          type: 'timeout_error';
          message?: string;
        }
      | null;

    type ServerDiscoveryWarning = {
      code: 'invalid_response';
      message: string;
      data?: any;
    };
  }
}

export let outputTypeMapper = new Map<number, PrismaJson.OutputType>([
  [0, 'stdout'],
  [1, 'stderr'],
  [2, 'debug.info'],
  [3, 'debug.warning'],
  [4, 'debug.error']
]);

export let outputTypeReverseMapper = new Map<PrismaJson.OutputType, number>(
  Array.from(outputTypeMapper.entries()).map(([k, v]) => [v, k])
);
