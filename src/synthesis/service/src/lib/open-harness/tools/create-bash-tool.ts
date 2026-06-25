import { tool } from 'ai';
import { z } from 'zod';
import type { ShellProvider } from '../providers/types';

export function createBashTool(shell: ShellProvider) {
  const bash = tool({
    description:
      'Run a bash command and return its output. ' +
      'Use this for git operations, running tests, installing packages, ' +
      'building projects, and any other shell tasks. ' +
      "Commands run in the project's working directory. " +
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
