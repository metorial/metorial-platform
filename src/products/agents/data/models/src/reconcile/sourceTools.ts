import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { v } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';

let exec = promisify(execFile);
let suiteSchema = v.object({ suite: v.enumOf(['provider', 'all', 'typecheck']) });
let outputLimit = 20_000;

export let assertSourceWrite = async (root: string, requested: string, cwd: string) => {
  let allowed = await realpath(root);
  let file = path.resolve(cwd, requested);
  if (!file.startsWith(`${allowed}${path.sep}`))
    throw new Error('Only the failing provider folder is writable');

  let current = file;
  while (current !== allowed) {
    try {
      let stat = await lstat(current);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
        throw new Error('Symlinks and hardlinks are not writable');
      if ((await realpath(current)) !== current) throw new Error('Path traverses a symlink');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    current = path.dirname(current);
  }
  return file;
};

export let providerTestCommand = (packageDir: string, directory: string, suite: string) => {
  if (suite === 'typecheck') return ['run', 'typecheck'];
  if (!['provider', 'all'].includes(suite)) throw new Error('Unknown test suite');
  return [
    'x',
    '--no-install',
    'vitest',
    'run',
    ...(suite === 'provider' ? [path.relative(packageDir, directory)] : []),
    '--cache=false',
    '--configLoader',
    'runner'
  ];
};

interface RepairExtension {
  on: (
    event: 'tool_call',
    handler: (
      event: { toolName: string; input: Record<string, unknown> },
      ctx: { cwd: string }
    ) => Promise<{ block: boolean; reason: string } | undefined>
  ) => void;
  registerTool: (tool: {
    name: string;
    label: string;
    description: string;
    parameters: unknown;
    execute: (
      id: string,
      parameters: unknown,
      signal: AbortSignal
    ) => Promise<{
      content: { type: 'text'; text: string }[];
      details: Record<string, unknown>;
    }>;
  }) => void;
}

export default function sourceTools(pi: RepairExtension) {
  let directory = process.env.MODEL_CATALOG_SOURCE_DIR;
  let packageDir = process.env.MODEL_CATALOG_PACKAGE_DIR;
  if (!directory || !packageDir) throw new Error('A provider repair capability is required');

  pi.on('tool_call', async (event, ctx) => {
    if (!['edit', 'write'].includes(event.toolName)) return;
    try {
      if (typeof event.input.path !== 'string') throw new Error('Missing write path');
      await assertSourceWrite(directory, event.input.path, ctx.cwd);
    } catch (error) {
      return { block: true, reason: (error as Error).message };
    }
  });

  pi.registerTool({
    name: 'test',
    label: 'Provider Tests',
    description:
      'Run provider tests, all catalog tests, or TypeScript checks. Use suite provider, all, or typecheck.',
    parameters: {
      type: 'object',
      properties: { suite: { type: 'string', enum: ['provider', 'all', 'typecheck'] } },
      required: ['suite'],
      additionalProperties: false
    },
    execute: async (_id, raw, signal) => {
      let { suite } = parseWith(suiteSchema, raw, 'test tool');
      try {
        let result = await exec('bun', providerTestCommand(packageDir, directory, suite), {
          cwd: packageDir,
          signal,
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024
        });
        return {
          content: [
            { type: 'text', text: `${result.stdout}\n${result.stderr}`.slice(-outputLimit) }
          ],
          details: { passed: true }
        };
      } catch (error) {
        let failure = error as Error & { stdout?: string; stderr?: string };
        return {
          content: [
            {
              type: 'text',
              text: `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.slice(
                -outputLimit
              )
            }
          ],
          details: { passed: false }
        };
      }
    }
  });
}
