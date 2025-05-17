import { type ServerSession } from '@metorial/db';
import { debug } from '@metorial/debug';
import { getSentry } from '@metorial/sentry';
import { getRunnerQueue } from '../../gateway/runnerQueue';
import { serverRunnerService } from '../../services';

let Sentry = getSentry();

export let ensureHostedRunner = (session: ServerSession) => {
  (async () => {
    let runner = await serverRunnerService.findServerRunner({
      session
    });

    await getRunnerQueue(runner).startSessionRun(session);
  })().catch(err => {
    debug.error('Failed to ensure hosted runner', err);
    Sentry.captureException(err);
  });
};
