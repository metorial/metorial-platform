import type {
  CreateFsToolsOptions,
  DirEntry,
  FileStat,
  FsProvider,
  ShellProvider,
  ShellResult
} from '@openharness/core';
import { createBashTool, createFsTools } from '@openharness/core';
import { Bash, type BashOptions, type IFileSystem } from 'just-bash';
import { posix as path } from 'node:path';

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
let DEFAULT_TIMEOUT = 30_000;
let DEFAULT_MAX_STDOUT = 50_000;
let DEFAULT_MAX_STDERR = 10_000;

let truncateOutput = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength)}\n... truncated ${value.length - maxLength} characters ...`;
};

class JustBashFsProvider implements FsProvider {
  constructor(
    private readonly fs: IFileSystem,
    private readonly cwd: string
  ) {}

  resolvePath(filePath: string) {
    return path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(this.cwd, filePath);
  }

  async readFile(filePath: string) {
    return await this.fs.readFile(this.resolvePath(filePath), 'utf8');
  }

  async writeFile(filePath: string, content: string) {
    let resolvedPath = this.resolvePath(filePath);
    await this.fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await this.fs.writeFile(resolvedPath, content);
  }

  async exists(filePath: string) {
    return await this.fs.exists(this.resolvePath(filePath));
  }

  async stat(filePath: string): Promise<FileStat> {
    let stat = await this.fs.stat(this.resolvePath(filePath));

    return {
      isFile: stat.isFile,
      isDirectory: stat.isDirectory,
      size: stat.size
    };
  }

  async readdir(dirPath: string): Promise<DirEntry[]> {
    let resolvedPath = this.resolvePath(dirPath);

    if (this.fs.readdirWithFileTypes) {
      let entries = await this.fs.readdirWithFileTypes(resolvedPath);

      return entries.map(entry => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory
      }));
    }

    let names = await this.fs.readdir(resolvedPath);
    let entries: DirEntry[] = [];

    for (let name of names) {
      let stat = await this.fs.stat(path.join(resolvedPath, name));

      entries.push({
        name,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory
      });
    }

    return entries;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }) {
    await this.fs.mkdir(this.resolvePath(dirPath), options);
  }

  async remove(filePath: string, options?: { recursive?: boolean }) {
    await this.fs.rm(this.resolvePath(filePath), options);
  }

  async rename(oldPath: string, newPath: string) {
    await this.fs.mv(this.resolvePath(oldPath), this.resolvePath(newPath));
  }
}

class JustBashShellProvider implements ShellProvider {
  constructor(
    private readonly bash: Bash,
    private readonly options: {
      cwd: string;
      env: Record<string, string>;
      maxStdout: number;
      maxStderr: number;
    }
  ) {}

  async exec(
    command: string,
    options?: { timeout?: number; cwd?: string; env?: Record<string, string> }
  ): Promise<ShellResult> {
    let controller = new AbortController();
    let timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    let timeoutHandle = setTimeout(() => controller.abort(), timeout);

    try {
      let result = await this.bash.exec(command, {
        cwd: options?.cwd ?? this.options.cwd,
        env: { ...this.options.env, ...options?.env },
        signal: controller.signal
      });

      return {
        stdout: truncateOutput(result.stdout, this.options.maxStdout),
        stderr: truncateOutput(result.stderr, this.options.maxStderr),
        exitCode: result.exitCode
      };
    } catch (e) {
      if (controller.signal.aborted) {
        return {
          stdout: '',
          stderr: `Command timed out after ${timeout}ms`,
          exitCode: 124
        };
      }

      throw e;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

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
