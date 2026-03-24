import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createAresInternalClient } from '@metorial-services/ares-client';
import { env } from './env';

export let aresClient: ReturnType<typeof createAresInternalClient> | null = env.ares
  .ARES_INTERNAL_URL
  ? createAresInternalClient({
      endpoint: env.ares.ARES_INTERNAL_URL
    })
  : null;

export type AresApp = Awaited<ReturnType<NonNullable<typeof aresClient>['app']['upsert']>>;

let aresAdminAppProm = new ProgrammablePromise<AresApp>();
export let aresAdminApp = aresAdminAppProm.promise;

(async () => {
  if (!aresClient) return;

  while (true) {
    console.log('Ensuring ares admin app');

    try {
      let res = await aresClient.app.upsert({
        slug: 'metorial-slates-hub-admin',
        defaultRedirectUrl: `${env.service.SERVICE_PUBLIC_URL}`,
        redirectDomains: [
          '*.metorial.com',
          '*.metorial.dev',
          '*.metorial.net',
          '*.metorial-internal.com'
        ]
      });

      aresAdminAppProm.resolve(res);
      console.log('Ares admin app is ready');

      return;
    } catch (err) {
      console.log('Failed to ensure ares admin app', err);
    }

    await delay(5000);
  }
})();
