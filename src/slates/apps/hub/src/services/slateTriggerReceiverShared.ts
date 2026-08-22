import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  SlatesWebhookHttp,
  SlatesWebhookHttpResponse,
  SlateWebhookRequestMatcher
} from '@slates/proto';
import { SlateTriggerReceiverTriggerSource } from '../../prisma/generated/client';
import type {
  Slate,
  SlateAction,
  SlateAuthConfig,
  SlateCallbackConfig,
  SlateInstance,
  SlateInstanceConfig,
  SlateConfigSchema,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger,
  Tenant
} from '../../prisma/generated/client';

export const normalizeEventTypes = (eventTypes?: string[] | null) =>
  eventTypes && eventTypes.length > 0 ? eventTypes : [];

export let isRoutableWebhookReceiverTrigger = (
  trigger: Pick<SlateTriggerReceiverTrigger, 'source' | 'tombstonedAt' | 'ingressDisabledAt'>
) =>
  trigger.source === SlateTriggerReceiverTriggerSource.webhook &&
  trigger.tombstonedAt === null &&
  trigger.ingressDisabledAt === null;

export type TriggerInvocationSpec =
  | {
      type: typeof SlateTriggerReceiverTriggerSource.polling;
      intervalSeconds: number;
    }
  | {
      type: typeof SlateTriggerReceiverTriggerSource.webhook;
      autoRegistration: boolean;
      autoUnregistration: boolean;
      http?: WebhookHttpCapability;
    };

export type WebhookHttpCapability = SlatesWebhookHttp;
export type WebhookHttpMethod = NonNullable<SlatesWebhookHttp['methods']>[number];
export type WebhookRequestMatcher = SlateWebhookRequestMatcher;

export type WebhookHttpResponse = SlatesWebhookHttpResponse;

export type TriggerActionSpec = {
  type: 'action.trigger';
  invocation: TriggerInvocationSpec;
};

export type ReceiverTriggerWithRelations = SlateTriggerReceiverTrigger & {
  action: SlateAction;
  receiver: SlateTriggerReceiver & {
    tenant: Tenant;
    slate: Slate;
    triggers: (SlateTriggerReceiverTrigger & { action: SlateAction })[];
    slateInstance: SlateInstance & {
      currentConfig: (SlateInstanceConfig & { schema: SlateConfigSchema }) | null;
    };
    authConfig: SlateAuthConfig | null;
    callbackConfig: SlateCallbackConfig | null;
  };
};

export const receiverInclude = {
  tenant: true,
  slate: true,
  slateInstance: {
    include: {
      currentConfig: { include: { schema: true } }
    }
  },
  triggers: {
    include: {
      action: true
    }
  },
  pathSecret: {
    select: {
      id: true,
      generation: true,
      plaintextIssuedAt: true,
      createdAt: true,
      updatedAt: true
    }
  },
  authConfig: true,
  callbackConfig: true
};

export const receiverTriggerInclude = {
  action: true,
  receiver: {
    include: receiverInclude
  }
};

export const getTriggerSpec = (action: SlateAction): TriggerActionSpec => {
  let spec = action.spec as TriggerActionSpec;
  if (!spec || spec.type !== 'action.trigger' || !spec.invocation) {
    throw new ServiceError(
      badRequestError({
        code: 'invalid_trigger_action',
        message: `Action ${action.id} is not a trigger.`
      })
    );
  }

  return spec;
};

export const webhookTriggerAllowsMethod = (action: SlateAction, requestMethod: string) => {
  let spec = getTriggerSpec(action);
  if (spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook) return false;

  let method = requestMethod.toUpperCase();
  return (spec.invocation.http?.methods ?? ['POST']).some(
    allowedMethod => allowedMethod === method
  );
};

export const buildInvocationAuth = (auth: {
  output?: Record<string, any> | null;
  input?: Record<string, any> | null;
  authMethod: { key: string };
}) => ({
  authenticationMethodId: auth.authMethod.key,
  data: auth.output ?? auth.input ?? {}
});
