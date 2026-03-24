import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  SlateTriggerReceiverTriggerSource,
  Slate,
  SlateAction,
  SlateAuthConfig,
  SlateInstance,
  SlateInstanceConfig,
  SlateTriggerDestination,
  SlateTriggerReceiver,
  SlateTriggerReceiverDestination,
  SlateTriggerReceiverTrigger,
  Tenant
} from '../../prisma/generated/client';

export const normalizeEventTypes = (eventTypes?: string[] | null) =>
  eventTypes && eventTypes.length > 0 ? eventTypes : [];

export type TriggerInvocationSpec =
  | {
      type: typeof SlateTriggerReceiverTriggerSource.polling;
      intervalSeconds: number;
    }
  | {
      type: typeof SlateTriggerReceiverTriggerSource.webhook;
      autoRegistration: boolean;
      autoUnregistration: boolean;
    };

export type TriggerActionSpec = {
  type: 'action.trigger';
  invocation: TriggerInvocationSpec;
};

export type ReceiverTriggerWithRelations = SlateTriggerReceiverTrigger & {
  action: SlateAction;
  receiver: SlateTriggerReceiver & {
    tenant: Tenant;
    slate: Slate;
    slateInstance: SlateInstance & {
      currentConfig: SlateInstanceConfig | null;
    };
    destinations: (SlateTriggerReceiverDestination & {
      destination: SlateTriggerDestination;
    })[];
    authConfig: SlateAuthConfig | null;
  };
};

export const receiverInclude = {
  tenant: true,
  slate: true,
  slateInstance: {
    include: {
      currentConfig: true
    }
  },
  destinations: {
    include: {
      destination: true
    }
  },
  triggers: {
    include: {
      action: true
    }
  },
  authConfig: true
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

export const buildInvocationAuth = (auth: {
  output?: Record<string, any> | null;
  input?: Record<string, any> | null;
  authMethod: { key: string };
}) => ({
  authenticationMethodId: auth.authMethod.key,
  data: auth.output ?? auth.input ?? {}
});
