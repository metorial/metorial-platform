import { Bash, type BashOptions } from 'just-bash';
import type { CreateFsToolsOptions, FsProvider, ShellProvider } from '../open-harness';
import { createBashTool, createFsTools } from '../open-harness';
import { JustBashFsProvider } from './fs';
import { JustBashShellProvider } from './shell';

export interface SandboxOptions extends BashOptions {
  cwd?: string;
  env?: Record<string, string>;
  fsTools?: CreateFsToolsOptions;
  maxStdout?: number;
  maxStderr?: number;
}

export interface Sandbox {
  bash: Bash;
  fs: FsProvider;
  shell: ShellProvider;
  tools: ReturnType<typeof createFsTools> & ReturnType<typeof createBashTool>;
}

let DEFAULT_CWD = '/workspace';
let DEFAULT_HOME = '/home/agent';
let DEFAULT_MAX_STDOUT = 50_000;
let DEFAULT_MAX_STDERR = 10_000;

export let createSandbox = async (options: SandboxOptions = {}): Promise<Sandbox> => {
  let cwd = options.cwd ?? DEFAULT_CWD;
  let env = {
    HOME: DEFAULT_HOME,
    PWD: cwd,
    ...options.env
  };

  let bash = new Bash({
    ...options,
    cwd,
    env
  });

  await bash.fs.mkdir(env.HOME, { recursive: true });
  await bash.fs.mkdir(cwd, { recursive: true });

  let fs = new JustBashFsProvider(bash.fs, cwd);
  let shell = new JustBashShellProvider(bash, {
    cwd,
    env,
    maxStdout: options.maxStdout ?? DEFAULT_MAX_STDOUT,
    maxStderr: options.maxStderr ?? DEFAULT_MAX_STDERR
  });
  let bashTools = createBashTool(shell);
  let fsTools = createFsTools(fs, options.fsTools);

  return {
    bash,
    fs,
    shell,
    tools: {
      ...fsTools,
      ...bashTools
    }
  };
};

export { JustBashFsProvider } from './fs';
export { JustBashShellProvider } from './shell';
