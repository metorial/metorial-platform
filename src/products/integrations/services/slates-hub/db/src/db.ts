import { createDatabase } from '@lowerdeck/prisma-pg';
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

export let { db, withTransaction } = createDatabase({
  name: 'slates-hub',
  url: ['SLATES_HUB_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    })
});

declare global {
  namespace SlatesHubPrismaJson {
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
      runtimeVersion?: string;
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
    type TriggerState = import('../prisma/generated/client').Prisma.JsonValue;

    type SlateProviderInfo = SlatesMessageProviderIdentifyResponse['result']['provider'];

    type SlateCapabilities = {
      hub?: {
        // Understands slates/hub.capabilities.set
        capabilitiesNotification?: boolean;
        // Understands slates/hub.live_invocation.set
        liveInvocation?: boolean;
        // Uploads live invocation attachments as signed multipart parts
        multipartUpload?: boolean;
        runtimeInfo?: boolean;
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

    type SlateOAuthCredentialsFixedInput = Record<string, string>;

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

    type TriggerEventAttributes = Record<string, string[]>;
  }
}
