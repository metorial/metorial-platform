import type { ErrorData } from '@lowerdeck/error';
import { withExecutionContextTraceFallback } from '@lowerdeck/telemetry';
import type { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { createDatabase } from '@lowerdeck/prisma-pg';

export { withPrimaryReads, withReplicaReads } from '@lowerdeck/prisma-pg';
import type { ChatBody, ChatContext, LinkUnfurl, ReactionCount } from '@slates/adapter-chat';
import { Prisma, PrismaClient } from '../prisma/generated/client';
import type {
  CustomProviderConfig,
  CustomProviderFrom,
  CustomProviderFromUpdate,
  ProtoGuardFamilyScore,
  ProtoGuardToolFinding,
  SecurityReport,
  SecurityReviewComputedScores,
  SecurityReviewFindingPayload,
  SecurityReviewRevisionContext,
  SecuritySpecCensus,
  SecurityUsageReport,
  SecurityUsageComputedScores,
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger,
  SpecificationTriggerGroup
} from './types';

export type EntityImage =
  | {
      type: 'file';
      fileId: string;
      fileLinkId: string;
      fileReferenceId: string;
      fileUrl: string;
      url?: string;
    }
  | { type: 'url'; url: string }
  | { type: 'icon'; icon: string; color: string }
  | { type: 'default' };

type EntityImageOuter = EntityImage;

let pointLookupOperations = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow'
]);
let readOperations = new Set([...pointLookupOperations, 'findMany']);

let loadsRelations = (args: any) =>
  !!args &&
  (!!args.include ||
    (!!args.select &&
      Object.values(args.select).some(value => typeof value === 'object' && value !== null)));

let queryExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        let strategyArgs: any =
          readOperations.has(operation) &&
          loadsRelations(args) &&
          (args as any).relationLoadStrategy === undefined
            ? {
                ...(args as any),
                relationLoadStrategy: pointLookupOperations.has(operation) ? 'join' : 'query'
              }
            : args;

        return await withExecutionContextTraceFallback(
          async () => await query(strategyArgs as any)
        );
      }
    }
  }
});

let database = createDatabase({
  name: 'integrations',
  url: ['SUBSPACE_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    }),
  extend: client => client.$extends(queryExtension) as any as PrismaClient,
  afterHookDelayMs: 5000,
  warnOnAfterHookOutsideTransaction: true
});

export let db: PrismaClient = database.db;

export let { withTransaction, addAfterTransactionHook, isInTransaction } = database;

declare global {
  namespace PrismaJson {
    // @ts-ignore
    type EntityImage = EntityImageOuter;

    type PublisherSource = { type: 'github'; url: string; owner: string; repo?: string };

    type ProviderSpecificationValue = {
      specification: Specification;
      authMethods: SpecificationAuthMethod[];
      features: SpecificationFeatures;
      tools: SpecificationTool[];
      triggers?: SpecificationTrigger[];
      triggerGroups?: SpecificationTriggerGroup[];
    };

    type ProviderAuthMethodValue = SpecificationAuthMethod;

    type ProviderToolValue = SpecificationTool;

    type ProviderTriggerValue = SpecificationTrigger;

    type ProviderAdapterCapabilities = {
      id: string;
      value: any;
    }[];

    type ChatMessageBody = ChatBody;

    type ChatMessageReactions = ReactionCount[];

    type ChatMessageUnfurls = LinkUnfurl[];

    type ChatChannelContext = ChatContext;

    type ChatThreadContext = ChatContext;

    // The presented event body. Shaped by the chat presenters, which cannot be imported here.
    type ChatEventPayload = { [key: string]: any };

    type ProviderTriggerGroupValue = SpecificationTriggerGroup;

    type ActionScopes = {
      AND: {
        OR: string[];
      }[];
    } | null;

    type ProviderAuthScopes = string[];

    type ProviderAuthCredentialsFixedInput = globalThis.Record<string, string>;

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
                type: 'tool_categories';
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

    type ProtoGuardFamilyScores = ProtoGuardFamilyScore[];

    type ProtoGuardToolFindings = ProtoGuardToolFinding[];

    type SecurityReviewReport = SecurityReport;

    type SecurityReviewScores = SecurityReviewComputedScores;

    type SecurityUsageReviewReport = SecurityUsageReport;

    type SecurityUsageReviewScores = SecurityUsageComputedScores;

    type SecurityReviewCensus = SecuritySpecCensus;

    type SecurityReviewFindingValue = SecurityReviewFindingPayload;

    type SecurityReviewRunContext = SecurityReviewRevisionContext;

    type SessionConnectionMcpData = {
      capabilities?: InitializeRequest['params']['capabilities'];
      protocolVersion?: InitializeRequest['params']['protocolVersion'];
      clientInfo?: InitializeRequest['params']['clientInfo'];
    };

    type SessionMessageOutput =
      | { type: 'tool.result'; data: any }
      | {
          type: 'error';
          data:
            | ErrorData<any, any>
            | { code: number | string; message: string; [key: string]: unknown };
        }
      | { type: 'mcp'; data: JSONRPCMessage };

    type SessionMessageInput =
      { type: 'tool.call'; data: any } | { type: 'mcp'; data: JSONRPCMessage };

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
            webhookRegistration: {
              status: 'supported' | 'unsupported';
              // Absent means `webhook_receiver`, so existing provider types keep their identifier.
              purpose?: 'webhook_receiver' | 'delivery_setup';
            };
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

    type TriggerGroupSelections = globalThis.Record<string, globalThis.Record<string, any>>;

    type SelectableTriggerGroups = {
      key: string;
      name: string;
      description: string | null;
      selectionSchema: globalThis.Record<string, any>;
      status: 'active' | 'selection_required';
      linkedOptionProviders?: globalThis.Record<string, string>;
    }[];

    type CallbackEventAttributes = globalThis.Record<string, string[]>;

    type WebhookRegistrationSetup = {
      document: string;
      schema?: globalThis.Record<string, any> | null;
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

    type ProviderConnectionDiscoveryError = {
      code: string;
      message: string;
      detail?: string;
    } | null;

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
