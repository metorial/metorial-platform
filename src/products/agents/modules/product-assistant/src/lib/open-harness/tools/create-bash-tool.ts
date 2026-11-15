import { tool } from 'ai';
import { z } from 'zod';
import type { ShellProvider } from '../providers/types';

export function createBashTool(shell: ShellProvider) {
  let bash = tool({
    description:
      'Run a bash command and return its output. ' +
      'Only use commands documented as available in your environment. ' +
      'The shell provider is a limited virtual shell; do not assume access to ' +
      'host programs, language runtimes, git, package managers, or build and test tools. ' +
      'Commands run in the configured working directory. ' +
      'Prefer dedicated file tools (readFile, writeFile, etc.) over shell equivalents (cat, echo >).',
    inputSchema: z.object({
      command: z.string().describe('The bash command to execute'),
      timeout: z
        .number()
        .int()
        .min(1000)
        .max(300000)
        .optional()
        .default(30000)
        .describe('Timeout in milliseconds (default 30s, max 5min)')
    }),
    execute: async ({ command, timeout }) => {
      return shell.exec(command, { timeout });
    }
  });

  return { bash };
}
