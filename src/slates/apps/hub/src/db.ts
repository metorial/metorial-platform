import { createPrismaPgAdapter } from '@lowerdeck/prisma-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import type {
  SlatesAction as ProtoSlatesAction,
  SlateAdapter as ProtoSlateAdapter,
  SlateAuthenticationMethod,
  SlatesMessageProviderIdentifyResponse,
  SlatesTriggerGroup,
  SlatesTriggerRoutingMatcher,
  SlatesWebhookHttpResponse as SlatesWebhookHttpResponseImport
} from '@slates/proto';
import { PrismaClient } from '../prisma/generated/client';

let mainAdapter = createPrismaPgAdapter(
  {
    connectionString: process.env.SLATES_HUB_DATABASE_URL ?? process.env.DATABASE_URL
  },
  {
    environment: process.env.METORIAL_ENV,
    databaseName: 'slates-hub',
    role: 'primary'
  }
);

let replicaAdapter = process.env.DATABASE_URL_READER
  ? createPrismaPgAdapter(
      {
        connectionString: process.env.DATABASE_URL_READER
      },
      {
        environment: process.env.METORIAL_ENV,
        databaseName: 'slates-hub',
        role: 'replica'
      }
    )
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
    type PortRange = {
      from: number;
      to: number;
    };

    type CompiledNetworkAllowEntry = {
      cidr: string;
      portRange?: PortRange;
    };

    type CompiledNetworkAllowList = {
      direction: 'ingress' | 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    type CompiledEgressNetworkAllowList = {
      direction: 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    interface SlateJson {
      name: string;
      version: string;
      description?: string;
      networkIsolation?: boolean;
      timeout?: number;
    }

    type SlateDeploymentProviderDeploymentInfo = {
      functionId: string;
      functionVersionId?: string;
      functionDeploymentId: string;
    } | null;

    type SlateConfigSchema = any;

    type SlateDocReference = {
      type?: string;
      name: string;
      url: string;
    };
    type SlateDocReferences = SlateDocReference[];

    type SlateAuthMethod = SlateAuthenticationMethod;
    type SlateAction = ProtoSlatesAction;
    type SlateAdapter = ProtoSlateAdapter;
    type SlateAdapterCapabilities = ProtoSlateAdapter['capabilities'];
    type SlateAdapterCapabilityValue = ProtoSlateAdapter['capabilities'][number]['value'];
    type SlateTriggerGroup = SlatesTriggerGroup;

    type SlateAuthMethods = SlateAuthenticationMethod[];
    type SlateActions = ProtoSlatesAction[];
    type SlateAdapters = ProtoSlateAdapter[];
    type SlateTriggerGroups = SlatesTriggerGroup[];

    // Normalized from the protocol's `id` to `key` during discovery
    type SlateToolCategory = {
      key: string;
      name: string;
      description?: string;
      imageUrl?: string;
    };
    type SlateToolCategories = SlateToolCategory[];

    type AnyRecord = Record<string, any>;

    type SlateProviderInfo = SlatesMessageProviderIdentifyResponse['result']['provider'];

    type SlateCapabilities = {
      hub?: {
        // Understands slates/hub.capabilities.set
        capabilitiesNotification?: boolean;
        // Understands slates/hub.live_invocation.set
        liveInvocation?: boolean;
      };
      provider?: {
        // Implements slates/trigger_groups.list and the rest of the
        // trigger_group.* protocol
        triggerGroups?: boolean;
        // Implements slates/tool_categories.list
        toolCategories?: boolean;
      };
    };

    type AuthProfile = {
      id?: string;
      email?: string;
      name?: string;
      imageUrl?: string;
      [key: string]: any;
    };

    type SlateWebhookEventRequest = {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: { encoding: 'base64'; content: string } | null;
    };

    type SlatesWebhookHttpResponse = SlatesWebhookHttpResponseImport;

    type SlateWebhookEventResponseOverride =
      | { webhookEventId: string }
      | { webhookEventId: string; warning: { code: string; message: string } }
      | { webhookEventId: string; error: { code: string; message: string; status: number } };

    type TriggerRawEventMatchers = SlatesTriggerRoutingMatcher[];
  }
}
