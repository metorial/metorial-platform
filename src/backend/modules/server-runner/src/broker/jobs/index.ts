import { ServerDeployment, ServerSession, ServerVariant } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { brokerRunnerExternalQueueProcessor, ensureExternalRunner } from './external';
import { ensureHostedRunner } from './hosted';

export let ensureRunnerForSession = async (
  session: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverVariant: ServerVariant;
    };
  }
) => {
  if (session.serverDeployment.serverVariant.sourceType == 'remote') {
    await ensureExternalRunner(session);
  } else {
    await ensureHostedRunner(session);
  }
};

export let runnerQueueProcessors = combineQueueProcessors([
  brokerRunnerExternalQueueProcessor
]);
