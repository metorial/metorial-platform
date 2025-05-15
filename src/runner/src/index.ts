import sade from 'sade';
import { startConnection } from './connection';
import { checkRunnerMachine } from './lib/check';
import { VERSION } from './version';

let prog = sade('metorial-runner')
  .describe('Metorial Runner CLI (https://metorial.com)')
  .version(VERSION);

prog
  .command('start <uri>', 'Start this runner and connect the Metorial', {
    default: true
  })
  .option('--tags', 'Comma separated tags for this runner (no spaces)')
  .option('--max-concurrent-jobs', 'Max concurrent jobs for this runner')
  .action(async (uri: string, opts: { tags?: string; ['max-concurrent-jobs']?: string }) => {
    if (!(await checkRunnerMachine())) process.exit(1);

    let host: string;
    let connectionKey: string;

    try {
      let url = new URL(uri);
      if (url.protocol !== 'mti:') {
        throw new Error('Invalid protocol, expected mti://');
      }

      host = url.host;
      connectionKey = url.username || url.password;

      if (!connectionKey) throw new Error('Missing connection key');
    } catch (e: any) {
      console.error('Invalid connection URI: ', e.message);
      process.exit(1);
    }

    console.log('Starting Metorial Runner');

    await startConnection({
      host,
      connectionKey,
      tags: opts.tags?.split(',').filter(Boolean) || [],
      maxConcurrentJobs: parseInt(opts['max-concurrent-jobs'] || '1', 10)
    });
  });

prog.parse(process.argv);
