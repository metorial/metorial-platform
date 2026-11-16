import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstance,
  SlateInstanceConfig,
  SlateVersion,
  Tenant
} from '../../../prisma/generated/client';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { slateInvocationService } from '../../services/slateInvocation';
import { resolveTriggerAuth } from './_triggerAuth';

type TriggerStackRegistration = {
  tenant: Tenant;
  slate: Slate;
  instance: SlateInstance | null;
  instanceConfig: SlateInstanceConfig | null;
  authConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
};

type TriggerStackOptions = {
  registration: TriggerStackRegistration;
  slateVersion?: SlateVersion;
  sessionId: string;
  note: string;
  minExpirationBuffer?: number;
};

export let prepareTriggerInstanceStack = async (d: TriggerStackOptions) => {
  let registration = d.registration;
  let version =
    d.slateVersion ??
    (await getActiveSlateVersion({
      slate: registration.slate,
      instance: registration.instance
    }));
  let auth = await resolveTriggerAuth({
    tenant: registration.tenant,
    slateInstance: registration.instance,
    authConfig: registration.authConfig,
    note: d.note,
    minExpirationBuffer: d.minExpirationBuffer
  });

  return {
    auth,
    createStack: () =>
      slateInvocationService.createInvocationWithState({
        participants: [],
        slateVersion: version,
        tenant: registration.tenant,
        session: { id: d.sessionId, state: {} },
        config: registration.instanceConfig?.value ?? {},
        auth
      })
  };
};

export let createTriggerInstanceStack = async (d: TriggerStackOptions) =>
  (await prepareTriggerInstanceStack(d)).createStack();
