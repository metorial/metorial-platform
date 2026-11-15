import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Log } from './log';
import { shorten } from './log';

let exec = promisify(execFile);

let botName = 'metorial-bot';
let botEmail = 'hey@metorial.com';
let errorLimit = 300;
let baseTrailer = /^Base: ([0-9a-f]{40})$/m;

export interface OverrideBranch {
  name: string;
  resumed: boolean;
  save: (message: string, sourceFiles?: string[]) => Promise<void>;
}

// Accepted decisions are committed and pushed to one long-lived branch after every batch, so a
// run that gets cancelled keeps its work and the next run picks the branch up again. The branch
// is always rebuilt on the current tip of the checked-out commit; the `Base:` trailer records which
// commit its overrides were made against, and the branch is only resumed while the overrides on
// that commit are identical to the ones here (nothing else touched them in between).
export let openOverrideBranch = async (opts: {
  root: string;
  name: string;
  overridesDir: string;
  allowedSourceDirectories?: string[];
  log: Log;
  redact?: (text: string) => string;
}): Promise<OverrideBranch | null> => {
  let redact = opts.redact ?? ((text: string) => text);
  let overrides = path.relative(opts.root, opts.overridesDir);

  let git = async (...args: string[]) =>
    (
      await exec('git', ['-C', opts.root, ...args], {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        maxBuffer: 64 * 1024 * 1024
      })
    ).stdout.trim();

  let describeError = (err: unknown) =>
    shorten(redact(String((err as any)?.stderr || (err as Error).message)), errorLimit);

  let base: string;
  let remoteTip: string;
  try {
    base = await git('rev-parse', 'HEAD');
    remoteTip = (await git('ls-remote', '--heads', 'origin', opts.name)).split(/\s/)[0] ?? '';
  } catch (err) {
    opts.log(
      `branch: can't reach origin, decisions will not be pushed per batch: ${describeError(err)}`
    );
    return null;
  }

  let resumed = false;
  if (!remoteTip)
    opts.log(`branch ${opts.name}: none on origin, starting from ${base.slice(0, 8)}`);
  else {
    try {
      await git('fetch', '--quiet', '--depth=1', 'origin', remoteTip);
      let recordedBase = (await git('log', '-1', '--format=%B', remoteTip)).match(
        baseTrailer
      )?.[1];
      if (!recordedBase) throw new Error('its last commit does not record a base');

      await git('fetch', '--quiet', '--depth=1', 'origin', recordedBase);
      let [then, now] = await Promise.all([
        git('rev-parse', `${recordedBase}:${overrides}`),
        git('rev-parse', `HEAD:${overrides}`)
      ]);
      if (then !== now) throw new Error(`overrides changed since ${recordedBase.slice(0, 8)}`);

      await rm(opts.overridesDir, { recursive: true, force: true });
      await git('checkout', remoteTip, '--', overrides);
      resumed = true;
      opts.log(
        `branch ${opts.name}: resumed from ${remoteTip.slice(0, 8)} (made against ${recordedBase.slice(0, 8)})`
      );
    } catch (err) {
      opts.log(`branch ${opts.name}: discarding what is on origin, ${describeError(err)}`);
    }
  }

  let commit = async (message: string, sourceFiles: string[] = []) => {
    let files = [overrides, ...sourceFiles];
    await git('add', '-A', '--', ...files);
    if (!(await git('diff', '--cached', '--name-only', '--', ...files))) return false;

    await git(
      '-c',
      `user.name=${botName}`,
      '-c',
      `user.email=${botEmail}`,
      'commit',
      '--quiet',
      '--only',
      '-m',
      message,
      '-m',
      `Base: ${base}`,
      '--',
      ...files
    );
    return true;
  };

  try {
    await git('checkout', '-B', opts.name);
    if (resumed) await commit('Model catalog: resume overrides');
  } catch (err) {
    opts.log(`branch ${opts.name}: could not create it locally: ${describeError(err)}`);
    return null;
  }

  return {
    name: opts.name,
    resumed,

    save: async (message, sourceFiles = []) => {
      if (
        sourceFiles.some(
          file =>
            path.normalize(file) !== file ||
            !opts.allowedSourceDirectories?.some(directory => file.startsWith(`${directory}/`))
        )
      )
        throw new Error('Cannot save a source outside the repair allowlist');
      try {
        let committed = await commit(message, sourceFiles);
        if (!committed) return;

        // Runs are serialized by the workflow, so whatever is on origin is this branch's own history.
        await git('push', '--quiet', '--force', 'origin', `HEAD:refs/heads/${opts.name}`);
        opts.log(
          `branch ${opts.name}: pushed ${(await git('rev-parse', '--short', 'HEAD')) || ''} (${message})`
        );
      } catch (err) {
        opts.log(`branch ${opts.name}: could not save this batch: ${describeError(err)}`);
      }
    }
  };
};
