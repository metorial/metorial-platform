import { Bash } from 'just-bash';
import type { ShellProvider, ShellResult } from '../open-harness';

let DEFAULT_TIMEOUT = 30_000;

let truncateOutput = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength)}\n... truncated ${value.length - maxLength} characters ...`;
};

export class JustBashShellProvider implements ShellProvider {
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
