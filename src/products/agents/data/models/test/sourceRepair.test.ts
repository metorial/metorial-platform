import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  link,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pricingSources } from '../src/sources/providers';
import { repairPricingSources, snapshotSourceFolder } from '../src/reconcile/sourceRepair';
import { assertSourceWrite, providerTestCommand } from '../src/reconcile/sourceTools';
import sourceTools from '../src/reconcile/sourceTools';
import { sandboxCommand } from '../src/reconcile/sandbox';
import { runAgent } from '../src/reconcile/agent';
import { proposedDecisions } from '../src/reconcile/proposals';
import type { CatalogIssue } from '../src/pipeline/issues';

let exec = promisify(execFile);
let roots: string[] = [];
let originalParsers = pricingSources.map(source => source.parse);

let setup = async () => {
  let root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'source-repair-test-')));
  roots.push(root);
  for (let kind of ['cerebras', 'xai']) {
    let source = pricingSources.find(source => source.kind === kind)!;
    let directory = path.dirname(path.join(root, source.file));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.ts'), `original ${kind}`);
    await writeFile(path.join(directory, 'index.test.ts'), 'original test');
  }
  await writeFile(path.join(root, 'protected.txt'), 'protected');
  return root;
};

afterEach(async () => {
  pricingSources.forEach((source, index) => {
    source.parse = originalParsers[index]!;
  });
  for (let root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('provider repair sessions', () => {
  it('resumes with host failures, keeps edits for fixing, and accepts implementation and test changes together', async () => {
    let root = await setup();
    let source = pricingSources.find(source => source.kind === 'cerebras')!;
    let file = path.join(root, source.file);
    let attempts: number[] = [];
    let validate = vi.fn(async () => {
      if ((await readFile(file, 'utf8')) !== 'fixed')
        throw new Error('unit conversion failed');
      return source.parse;
    });

    let repaired = await repairPricingSources({
      failures: [{ source: 'cerebras', raw: { changed: true }, problems: ['layout changed'] }],
      packageDir: root,
      run: async (failure, _source, attempt) => {
        attempts.push(attempt);
        if (attempt) {
          expect(failure.problems.join(' ')).toContain('unit conversion failed');
          expect(await readFile(file, 'utf8')).toBe('broken');
        }
        await writeFile(file, attempt ? 'fixed' : 'broken');
        await writeFile(path.join(path.dirname(file), 'new.test.ts'), 'regression test');
        return { exitCode: 0, testCalls: 1 };
      },
      validate
    });

    expect(attempts).toEqual([0, 1]);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(repaired[0]?.files.sort()).toEqual([
      'src/sources/cerebras/index.ts',
      'src/sources/cerebras/new.test.ts'
    ]);
    expect(await readFile(path.join(root, 'src/sources/xai/index.ts'), 'utf8')).toBe(
      'original xai'
    );
    expect(await readFile(path.join(root, 'protected.txt'), 'utf8')).toBe('protected');
  });

  it('requires the agent to run tests before the host verifies the result', async () => {
    let root = await setup();
    let source = pricingSources.find(source => source.kind === 'cerebras')!;
    let validate = vi.fn(async () => source.parse);
    let run = vi.fn(async (failure, _source, attempt) => {
      if (attempt) expect(failure.problems.join(' ')).toContain('Run the provider tests');
      await writeFile(path.join(root, source.file), 'fixed');
      return { exitCode: 0, testCalls: attempt ? 1 : 0 };
    });

    await repairPricingSources({
      failures: [{ source: 'cerebras', raw: {}, problems: [] }],
      packageDir: root,
      run,
      validate
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('rolls back every repaired folder when retries for another provider are exhausted', async () => {
    let root = await setup();
    let run = vi.fn(async (_failure, source) => {
      await writeFile(path.join(root, source.file), 'candidate');
      await writeFile(
        path.join(path.dirname(path.join(root, source.file)), 'new.test.ts'),
        'new test'
      );
      return { exitCode: 0, testCalls: 1 };
    });

    await expect(
      repairPricingSources({
        failures: [
          { source: 'cerebras', raw: {}, problems: [] },
          { source: 'xai', raw: {}, problems: [] }
        ],
        packageDir: root,
        run,
        validate: async source => {
          if (source.kind === 'xai') throw new Error('still failing');
          return source.parse;
        }
      })
    ).rejects.toThrow('still failing');
    expect(run).toHaveBeenCalledTimes(4);
    for (let kind of ['cerebras', 'xai']) {
      expect(await readFile(path.join(root, `src/sources/${kind}/index.ts`), 'utf8')).toBe(
        `original ${kind}`
      );
      expect(existsSync(path.join(root, `src/sources/${kind}/new.test.ts`))).toBe(false);
    }
  });

  it('rejects unknown source capabilities before starting an agent', async () => {
    let root = await setup();
    let run = vi.fn();
    await expect(
      repairPricingSources({
        failures: [{ source: 'openrouter', raw: {}, problems: [] }],
        packageDir: root,
        run,
        validate: vi.fn()
      })
    ).rejects.toThrow('No repairable response');
    expect(run).not.toHaveBeenCalled();
  });

  it('restores unsafe folder replacements before resuming a failed session', async () => {
    let root = await setup();
    let source = pricingSources.find(source => source.kind === 'cerebras')!;
    let directory = path.dirname(path.join(root, source.file));
    let healthy = path.join(root, 'src/sources/xai');

    await repairPricingSources({
      failures: [{ source: 'cerebras', raw: {}, problems: [] }],
      packageDir: root,
      run: async (_failure, _source, attempt) => {
        if (!attempt) {
          await rm(directory, { recursive: true });
          await symlink(healthy, directory);
        } else {
          expect(await realpath(directory)).toBe(directory);
          expect(await readFile(path.join(directory, 'index.ts'), 'utf8')).toBe(
            'original cerebras'
          );
          await writeFile(path.join(directory, 'index.ts'), 'fixed');
        }
        return { exitCode: 0, testCalls: 1 };
      },
      validate: async () => source.parse
    });
    expect(await readFile(path.join(healthy, 'index.ts'), 'utf8')).toBe('original xai');
  });
});

describe('provider write capabilities', () => {
  it('allows new files inside the failed folder and blocks traversal, siblings, symlinks, and hardlinks', async () => {
    let root = await setup();
    let directory = path.join(root, 'src/sources/cerebras');
    expect(
      await assertSourceWrite(directory, 'src/sources/cerebras/fixtures/new.json', root)
    ).toBe(path.join(directory, 'fixtures/new.json'));
    for (let file of [
      'protected.txt',
      'src/sources/xai/index.ts',
      'src/sources/cerebras/../xai/index.ts',
      'src/sources/cerebras-other/index.ts'
    ])
      await expect(assertSourceWrite(directory, file, root)).rejects.toThrow(
        'Only the failing provider'
      );

    await symlink(path.join(root, 'protected.txt'), path.join(directory, 'linked'));
    await expect(
      assertSourceWrite(directory, path.join(directory, 'linked'), root)
    ).rejects.toThrow('Symlinks');
    await expect(snapshotSourceFolder(directory)).rejects.toThrow('symlinks');
    await rm(path.join(directory, 'linked'));
    await link(path.join(root, 'protected.txt'), path.join(directory, 'hardlinked'));
    await expect(
      assertSourceWrite(directory, path.join(directory, 'hardlinked'), root)
    ).rejects.toThrow('hardlinks');
  });

  it('never grants sandbox access through a replaced source or scratch directory', async () => {
    let root = await setup();
    let alias = path.join(root, 'alias');
    await symlink(path.join(root, 'src/sources/xai'), alias);
    let command = {
      command: process.execPath,
      args: [],
      writable: [alias],
      scratch: path.join(root, 'scratch')
    };
    await expect(sandboxCommand(command)).rejects.toThrow('must not traverse symlinks');
    await expect(sandboxCommand({ ...command, writable: [], scratch: alias })).rejects.toThrow(
      'must not traverse symlinks'
    );
  });

  it('blocks writes through the actual extension and exposes only fixed test commands', async () => {
    let root = await setup();
    let oldDirectory = process.env.MODEL_CATALOG_SOURCE_DIR;
    let oldPackage = process.env.MODEL_CATALOG_PACKAGE_DIR;
    process.env.MODEL_CATALOG_SOURCE_DIR = path.join(root, 'src/sources/cerebras');
    process.env.MODEL_CATALOG_PACKAGE_DIR = root;
    let handler: any;
    let test: any;
    try {
      sourceTools({
        on: (_event, callback) => {
          handler = callback;
        },
        registerTool: tool => {
          test = tool;
        }
      });
      expect(
        await handler({ toolName: 'write', input: { path: 'protected.txt' } }, { cwd: root })
      ).toMatchObject({ block: true });
      expect(
        await handler(
          { toolName: 'edit', input: { path: 'src/sources/cerebras/index.test.ts' } },
          { cwd: root }
        )
      ).toBeUndefined();
      await expect(test.execute('id', { suite: 'provider; rm -rf /' })).rejects.toThrow();
      expect(
        providerTestCommand(root, path.join(root, 'src/sources/cerebras'), 'provider')
      ).toEqual([
        'x',
        '--no-install',
        'vitest',
        'run',
        'src/sources/cerebras',
        '--cache=false',
        '--configLoader',
        'runner'
      ]);
    } finally {
      if (oldDirectory === undefined) delete process.env.MODEL_CATALOG_SOURCE_DIR;
      else process.env.MODEL_CATALOG_SOURCE_DIR = oldDirectory;
      if (oldPackage === undefined) delete process.env.MODEL_CATALOG_PACKAGE_DIR;
      else process.env.MODEL_CATALOG_PACKAGE_DIR = oldPackage;
    }
  });

  it('executes provider tests through the extension test tool', async () => {
    let packageDir = path.resolve(import.meta.dirname, '..');
    let oldDirectory = process.env.MODEL_CATALOG_SOURCE_DIR;
    let oldPackage = process.env.MODEL_CATALOG_PACKAGE_DIR;
    let tool: any;
    process.env.MODEL_CATALOG_SOURCE_DIR = path.join(packageDir, 'src/sources/cerebras');
    process.env.MODEL_CATALOG_PACKAGE_DIR = packageDir;

    try {
      sourceTools({
        on: () => {},
        registerTool: registered => {
          tool = registered;
        }
      });
      let result = await tool.execute(
        'test-id',
        { suite: 'provider' },
        new AbortController().signal
      );
      expect(result.details.passed).toBe(true);
      expect(result.content[0].text).toContain('passed');
    } finally {
      if (oldDirectory === undefined) delete process.env.MODEL_CATALOG_SOURCE_DIR;
      else process.env.MODEL_CATALOG_SOURCE_DIR = oldDirectory;
      if (oldPackage === undefined) delete process.env.MODEL_CATALOG_PACKAGE_DIR;
      else process.env.MODEL_CATALOG_PACKAGE_DIR = oldPackage;
    }
  });

  it.skipIf(
    process.env.MODEL_CATALOG_SANDBOX === '1' ||
      (process.platform === 'linux' && !existsSync('/usr/bin/bwrap'))
  )('enforces folder writes for code executed by tests too', async () => {
    let root = await setup();
    let directory = path.join(root, 'src/sources/cerebras');
    let protectedFile = path.join(root, 'protected.txt');
    let program = `let fs=require('node:fs');fs.writeFileSync(${JSON.stringify(path.join(directory, 'new.txt'))},'allowed');try{fs.writeFileSync(${JSON.stringify(protectedFile)},'changed');process.exit(9)}catch{console.log('blocked')}`;
    let command = await sandboxCommand({
      command: process.execPath,
      args: ['-e', program],
      writable: [directory],
      scratch: path.join(root, 'scratch')
    });
    let result = await exec(command.command, command.args, {
      env: { ...process.env, ...command.env }
    });
    expect(result.stdout.trim()).toBe('blocked');
    expect(await readFile(protectedFile, 'utf8')).toBe('protected');
  });

  it.skipIf(
    process.env.MODEL_CATALOG_SANDBOX === '1' ||
      (process.platform === 'linux' && !existsSync('/usr/bin/bwrap'))
  )(
    'starts an editable sandboxed agent with the scoped extension and records its test run',
    async () => {
      let root = await setup();
      let directory = path.join(root, 'src/sources/cerebras');
      let piBin = path.join(root, 'fake-pi');
      let program = `#!/usr/bin/env node
let fs=require('node:fs');
let args=process.argv.slice(2);
if(!args.includes('--extension')||args[args.indexOf('--tools')+1]!=='read,grep,find,ls,edit,write,test')process.exit(11);
fs.writeFileSync(process.env.MODEL_CATALOG_SOURCE_DIR+'/index.ts','agent edit');
try{fs.writeFileSync(${JSON.stringify(path.join(root, 'protected.txt'))},'escaped');process.exit(12)}catch{}
console.log(JSON.stringify({type:'tool_execution_start',toolName:'test',args:{suite:'provider'}}));
console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'repaired'}]}}));
`;
      await writeFile(piBin, program);
      await chmod(piBin, 0o755);
      let run = await runAgent({
        piBin,
        model: 'test',
        thinking: 'low',
        cwd: root,
        workDir: path.join(root, 'work'),
        systemPromptFile: path.join(root, 'prompt.md'),
        message: 'repair',
        continueSession: false,
        credentials: { apiToken: 'test', accountId: 'test' },
        timeoutMs: 10_000,
        logFile: path.join(root, 'agent.log'),
        log: () => {},
        label: 'test',
        writableDirectory: directory
      });

      expect(run).toMatchObject({ exitCode: 0, testCalls: 1, answer: 'repaired' });
      expect(await readFile(path.join(directory, 'index.ts'), 'utf8')).toBe('agent edit');
      expect(await readFile(path.join(root, 'protected.txt'), 'utf8')).toBe('protected');
    }
  );
});

it('keeps override proposals inside the current issue batch', () => {
  let before = { merges: {}, models: {}, families: {}, offerings: {} };
  let batch = [
    { key: 'vendor/model', vendorId: 'vendor', vendorModelId: 'model' }
  ] as CatalogIssue[];
  let answer = JSON.stringify({
    decisions: [{ key: 'vendor/model', decision: { decision: 'router', reason: 'routes' } }]
  });
  expect(proposedDecisions({ answer, before, batch }).offerings.vendor?.model).toEqual({
    decision: 'router',
    reason: 'routes'
  });
  expect(() =>
    proposedDecisions({
      answer: answer.replace('vendor/model', 'healthy/model'),
      before,
      batch
    })
  ).toThrow('outside the batch');
  expect(before.offerings).toEqual({});
});
