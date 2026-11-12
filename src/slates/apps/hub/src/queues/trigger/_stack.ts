import type { Prisma } from '../../../prisma/generated/client';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { slateInvocationService } from '../../services/slateInvocation';
import { resolveTriggerAuth } from './_triggerAuth';

type TriggerStackRegistration = Prisma.TriggerRegistrationGetPayload<{
  include: {
    tenant: true;
    slate: true;
    instance: true;
    instanceConfig: true;
    authConfig: { include: { authMethod: true } };
  };
}>;

type TriggerStackOptions = {
  registration: TriggerStackRegistration;
  sessionId: string;
  note: string;
  minExpirationBuffer?: number;
};

// Resolves the version and credentials once so long-lived callers can reuse them.
export let prepareTriggerInstanceStack = async (d: TriggerStackOptions) => {
  let registration = d.registration;
  let version = await getActiveSlateVersion({
    slate: registration.slate,
    instance: registration.instance
  });
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
        config: registration.instanceConfig.value ?? {},
        auth
      })
  };
};

export let createTriggerInstanceStack = async (d: TriggerStackOptions) =>
  (await prepareTriggerInstanceStack(d)).createStack();
