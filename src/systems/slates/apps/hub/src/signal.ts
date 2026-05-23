import { delay } from '@mtsrc/delay';
import { ProgrammablePromise } from '@mtsrc/programmable-promise';
import { createSignalClient } from '@metorial-platform-systems/signal-client';
import type { Tenant } from '../prisma/generated/client';
import { db } from './db';
import { env } from './env';

export let signal: ReturnType<typeof createSignalClient> = createSignalClient({
  endpoint: env.signal.SIGNAL_API_URL
});

let signalTriggerSenderPromise = new ProgrammablePromise<
  Awaited<ReturnType<typeof signal.sender.upsert>>
>();
export let signalTriggerSender = signalTriggerSenderPromise.promise;

export let getTenantAndSenderForSignal = async (tenant: Tenant) => {
  if (!tenant.signalTenantId) {
    let newTenant = await signal.tenant.upsert({
      name: tenant.name,
      identifier: tenant.identifier
    });

    tenant = await db.tenant.update({
      where: { id: tenant.id },
      data: { signalTenantId: newTenant.id }
    });
  }

  return {
    sender: await signalTriggerSender,
    tenant: {
      id: tenant.signalTenantId!,
      identifier: tenant.identifier
    }
  };
};

(async () => {
  console.log('Ensuring signal sender exists...');

  while (true) {
    try {
      let sender = await Promise.race([
        signal.sender.upsert({
          name: 'Slates Triggers',
          identifier: env.signal.SIGNAL_SENDER_IDENTIFIER
        }),
        delay(10000).then(() => {
          throw new Error('Signal sender initialization timed out');
        })
      ]);

      signalTriggerSenderPromise.resolve(sender);
      console.log(`Signal sender ID: ${sender.id}`);
      return;
    } catch (err) {
      console.log('Unable to create signal sender', err);
    }

    await delay(5000);
  }
})();
