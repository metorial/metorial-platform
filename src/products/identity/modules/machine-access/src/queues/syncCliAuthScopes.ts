import { createQueue } from '@metorial/queue';
import { oauthApplicationService } from '../services/oauthApplication';

let syncCliAuthScopesQueue = createQueue({
  name: 'macc/oauthApplication/cliAuth/syncScopes',
  workerOpts: { concurrency: 1 }
});

export let syncCliAuthScopesQueueProcessor = syncCliAuthScopesQueue.process(async () => {
  await oauthApplicationService.syncCliAuthOAuthApplicationScopes();
});

export let startCliAuthScopesSync = async () => {
  await syncCliAuthScopesQueue.add({}, { id: 'startup-cli-auth-scopes' });
};
