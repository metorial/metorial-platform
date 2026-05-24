import { DockerError } from '../errors';
import type { RunPhase } from '../types';
import { registerProcess } from './lifecycle';

export type ShellOpts = {
  cwd?: string;
  env?: Record<string, string>;
  phase: RunPhase;
  service?: string;
  composeFile?: string;
  keep?: boolean;
  verbose?: boolean;
};

export let runShell = async (cmd: string[], opts: ShellOpts) => {
  let proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'ignore',
    detached: process.platform !== 'win32'
  });
  let unregister = registerProcess({
    pid: proc.pid,
    command: cmd.join(' '),
    kill: signal => proc.kill(signal)
  });

  try {
    let code = await proc.exited;
    if (code !== 0) {
      throw new DockerError({
        phase: opts.phase,
        command: cmd.join(' '),
        exitCode: code,
        service: opts.service,
        composeFile: opts.composeFile,
        keep: opts.keep
      });
    }
  } finally {
    unregister();
  }
};
