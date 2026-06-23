import type { ErrorData } from '@lowerdeck/error';
import { withExecutionContextTraceFallback } from '@lowerdeck/telemetry';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger
} from '@metorial-subspace/provider-utils';
import type { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { PrismaClient } from '../prisma/generated/client';
import type {
  CustomProviderConfig,
  CustomProviderFrom,
  CustomProviderFromUpdate
} from './types';

export type EntityImage = any;

let mainAdapter = new PrismaPg({
  connectionString: process.env.SUBSPACE_DATABASE_URL ?? process.env.DATABASE_URL
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

export let db = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return await withExecutionContextTraceFallback(async () => await query(args));
      }
    }
  }
});

declare global {
  namespace PrismaJson {
    type PublisherSource = { type: 'github'; url: string; owner: string; repo?: string };

    type ProviderSpecificationValue = {
      specification: Specification;
      authMethods: SpecificationAuthMethod[];
      features: SpecificationFeatures;
      tools: SpecificationTool[];
      triggers?: SpecificationTrigger[];
    };

    type ProviderAuthMethodValue = SpecificationAuthMethod;

    type ProviderToolValue = SpecificationTool;

    type ProviderTriggerValue = SpecificationTrigger;

    type ActionScopes = {
      AND: {
        OR: string[];
      }[];
    } | null;

    type ProviderAuthScopes = string[];

    type ToolFilter =
      | {
          type: 'v1.allow_all';
          ignoreParentFilters?: boolean;
        }
      | {
          type: 'v1.filter';
          ignoreParentFilters?: boolean;
          filters: (
            | {
                type: 'tool_keys';
                keys: string[];
              }
            | {
                type: 'tool_regex';
                pattern: string;
              }
            | {
                type: 'resource_regex';
                pattern: string;
              }
            | {
                type: 'resource_uris';
                uris: string[];
              }
            | {
                type: 'prompt_keys';
                keys: string[];
              }
            | {
                type: 'prompt_regex';
                pattern: string;
              }
          )[];
        };

    type ToolFilterChain = ToolFilter | ToolFilter[];

    type ProviderSetupSessionProviderSearch = {
      groups?: { groupId: string }[];
      collections?: { collectionId: string }[];
      categories?: { categoryId: string }[];
    };

    type ProviderSetupSessionUi = {
      layout?: 'box' | 'side' | 'light';
    };

    type ProviderSetupSessionConfiguration = {
      providerSearch?: ProviderSetupSessionProviderSearch;
      toolFilters?: {
        enabled?: boolean;
      };
      ui?: ProviderSetupSessionUi;
    };

    type SessionConnectionMcpData = {
      capabilities?: InitializeRequest['params']['capabilities'];
      protocolVersion?: InitializeRequest['params']['protocolVersion'];
      clientInfo?: InitializeRequest['params']['clientInfo'];
    };

    type SessionMessageOutput =
      | { type: 'tool.result'; data: any }
      | {
          type: 'error';
          data: ErrorData<any, any> | { code: number | string; message: string };
        }
      | { type: 'mcp'; data: JSONRPCMessage };

    type SessionMessageInput =
      | { type: 'tool.call'; data: any }
      | { type: 'mcp'; data: JSONRPCMessage };

    type SessionMessageClientMcpId = string | number | null;

    type SessionParticipantPayload = {
      identifier: string;
      name: string;
      [key: string]: any;
    };

    type CustomProviderPayload = {
      from: CustomProviderFrom;
      config: CustomProviderConfig | undefined;
    };

    type UpcomingCustomProviderPayload = {
      from?: CustomProviderFromUpdate;
      config?: CustomProviderConfig;
    };

    type ProviderListingDocReference = {
      type?: string;
      name: string;
      url: string;
    };

    type ProviderListingDocs = {
      provider: ProviderListingDocReference[];
      config: ProviderListingDocReference[];
      authMethods: {
        key: string;
        name: string;
        type: string;
        docs: ProviderListingDocReference[];
      }[];
      actions: {
        key: string;
        name: string;
        type: 'tool' | 'trigger';
        docs: ProviderListingDocReference[];
      }[];
    };

    type ProviderTypeAttributes = {
      provider: 'metorial-slates' | 'metorial-shuttle' | 'metorial-native';
      backend: 'slates' | 'mcp.container' | 'mcp.function' | 'mcp.remote' | 'native';

      triggers:
        | {
            status: 'enabled';
            receiverUrl: string;
          }
        | { status: 'disabled' };

      auth:
        | {
            status: 'enabled';

            oauth:
              | {
                  status: 'enabled';
                  oauthAutoRegistration?: { status: 'supported' | 'unsupported' };
                  oauthCallbackUrl: string;
                }
              | { status: 'disabled'; oauthAutoRegistration?: undefined };

            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled'; oauth?: undefined; export?: undefined; import?: undefined };

      config:
        | {
            status: 'enabled';
            read: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled'; read?: undefined };
    };

    type ProviderDeploymentConfigPairDiscoveryError =
      | {
          type: 'mcp_error';
          error: {
            code: number;
            message: string;
            data?: any;
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

    type ProviderDeploymentConfigPairDiscoveryWarning = {
      code: string;
      message: string;
      data?: any;
    };

    type NetworkPolicyPortRange = {
      from: number;
      to: number;
    };

    type NetworkPolicyRule = {
      id: string;
      effect: 'allow' | 'deny';
      direction: 'ingress' | 'egress';
      cidrs: string[];
      description?: string;
      enabled: boolean;
      priority: number;
      ports?: NetworkPolicyPortRange[];
    };

    type NetworkPolicyRules = NetworkPolicyRule[];

    type CompiledNetworkAllowEntry = {
      cidr: string;
      portRange?: NetworkPolicyPortRange;
    };

    type CompiledNetworkAllowList = {
      direction: 'ingress' | 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    type CompiledEgressNetworkAllowList = {
      direction: 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    type CompiledNetworkRules = {
      ingress: CompiledNetworkAllowList;
      egress: CompiledNetworkAllowList;
    };
  }
}
