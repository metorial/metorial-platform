import { ServerDeployment, ServerInstance, ServerSession, ServerVariant } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { brokerRunnerExternalQueueProcessor, ensureExternalRunner } from './external';
import { brokerRunnerHostedQueueProcessor, ensureHostedRunner } from './hosted';

export let ensureRunnerForSession = async (
  session: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverInstance: ServerInstance & {
        serverVariant: ServerVariant;
      };
    };
  }
) => {
  if (session.serverDeployment.serverInstance.serverVariant.sourceType == 'remote') {
    await ensureExternalRunner(session);
  } else {
    await ensureHostedRunner(session);
  }
};

export let runnerQueueProcessors = combineQueueProcessors([
  brokerRunnerHostedQueueProcessor,
  brokerRunnerExternalQueueProcessor
]);
