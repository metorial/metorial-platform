import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as commands from '../src/process';
import { acquireLock } from '../src/lock';
import { atomicWrite } from '../src/files';
import { temporary } from './helpers';

test('captured commands drain output, report stderr, and preserve environment', async () => {
  let root = temporary();

  expect(
    await commands.output(
      process.execPath,
      ['-e', 'process.stdout.write(process.env.CONTROL_TEST_VALUE)'],
      root,
      { CONTROL_TEST_VALUE: 'a b $value' }
    )
  ).toBe('a b $value');

  await expect(
    commands.output(
      process.execPath,
      ['-e', "process.stderr.write('failure detail');process.exit(9)"],
      root
    )
  ).rejects.toThrow('failure detail');

  await expect(commands.output('/not/a/program', [], root)).rejects.toThrow(
    'could not launch'
  );

  expect(
    (
      await commands.output(
        process.execPath,
        [
          '-e',
          "process.stdout.write('x'.repeat(500000));process.stderr.write('y'.repeat(500000))"
        ],
        root
      )
    ).length
  ).toBe(500000);
});

test('input and binary pipelines stream without truncating or deadlocking', async () => {
  let root = temporary();
  let output = join(root, 'output');
  await commands.runWithInput(
    process.execPath,
    [
      '-e',
      `let chunks=[];for await(let chunk of process.stdin) chunks.push(chunk);require('node:fs').writeFileSync(${JSON.stringify(output)},Buffer.concat(chunks));`
    ],
    'payload $&\n',
    root
  );

  expect(readFileSync(output, 'utf8')).toBe('payload $&\n');

  await commands.pipe(
    process.execPath,
    ['-e', 'process.stdout.write(Buffer.alloc(3000000, 173))'],
    process.execPath,
    [
      '-e',
      `let chunks=[];for await(let chunk of process.stdin) chunks.push(chunk);require('node:fs').writeFileSync(${JSON.stringify(output)},Buffer.concat(chunks));`
    ],
    root
  );

  let bytes = readFileSync(output);

  expect(bytes.length).toBe(3000000);
  expect(bytes.every(byte => byte === 173)).toBe(true);
});

test('pipeline errors terminate both processes and retain the failed side diagnostics', async () => {
  let root = temporary();
  await expect(
    commands.pipe(
      process.execPath,
      ['-e', "process.stderr.write('source failed');process.exit(3)"],
      process.execPath,
      ['-e', 'for await(let _ of process.stdin) {}'],
      root
    )
  ).rejects.toThrow('source failed');

  await expect(
    commands.pipe(
      process.execPath,
      ['-e', 'setInterval(()=>process.stdout.write(Buffer.alloc(100000)),1)'],
      process.execPath,
      ['-e', "process.stderr.write('target failed');process.exit(4)"],
      root
    )
  ).rejects.toThrow('target failed');
});

test('file locks serialize holders and release cleanly', async () => {
  let path = join(temporary(), 'lock');
  let release = await acquireLock(path);
  let acquired = false;
  let waiting = acquireLock(path).then(unlock => {
    acquired = true;

    return unlock;
  });

  await commands.delay(40);

  expect(acquired).toBe(false);
  release();

  let releaseSecond = await waiting;

  expect(acquired).toBe(true);
  releaseSecond();
});

test('SIGINT cancels the child process tree and exits without leaving grandchildren', async () => {
  let root = temporary();
  let pidFile = join(root, 'grandchild');
  let parentFile = join(root, 'parent.ts');
  let modulePath = resolve(import.meta.dir, '../src/process.ts');

  atomicWrite(
    parentFile,
    `import {run, Interrupted} from ${JSON.stringify(modulePath)};try { await run(process.execPath,['-e',${JSON.stringify(`let child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`)}],{stdio:'ignore'});setInterval(()=>{},1000)`)}],${JSON.stringify(root)}); } catch(error) { process.exitCode=error instanceof Interrupted ? 130 : 1; }`
  );

  let child = Bun.spawn([process.execPath, parentFile], { stdout: 'pipe', stderr: 'pipe' });
  let deadline = Date.now() + 3000;

  while (!existsSync(pidFile) && Date.now() < deadline) await commands.delay(10);

  expect(existsSync(pidFile)).toBe(true);

  let grandchild = Number(readFileSync(pidFile, 'utf8'));
  child.kill('SIGINT');

  expect(await child.exited).toBe(130);

  let alive = () => {
    try {
      process.kill(grandchild, 0);

      return true;
    } catch {
      return false;
    }
  };
  deadline = Date.now() + 2000;

  while (alive() && Date.now() < deadline) await commands.delay(20);

  expect(alive()).toBe(false);
}, 10000);
