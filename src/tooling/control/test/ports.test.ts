import { expect, spyOn, test } from 'bun:test';
import { createServer } from 'node:net';
import { clearServicePorts, listeningProcesses } from '../src/ports';
import * as commands from '../src/process';
import { listenerFixture, temporary } from './helpers';

test('frees occupied ports, logs their owners and preserves listeners on other ports', async () => {
  let cwd = temporary();
  let first = await listenerFixture(cwd);
  let second = await listenerFixture(cwd);
  let unrelated = await listenerFixture(cwd);
  let logs: string[] = [];

  try {
    await clearServicePorts([first.port, second.port, first.port], cwd, text =>
      logs.push(text)
    );

    expect(await listeningProcesses([first.port, second.port], cwd)).toEqual([]);
    expect((await listeningProcesses([unrelated.port], cwd))[0]?.pid).toBe(
      unrelated.child.pid!
    );

    expect(
      logs.some(
        line =>
          line.includes(`port ${first.port}`) &&
          line.includes(`pid ${first.child.pid}`) &&
          line.includes('SIGTERM')
      )
    ).toBe(true);
    expect(
      logs.some(
        line =>
          line.includes(`port ${second.port}`) && line.includes(`pid ${second.child.pid}`)
      )
    ).toBe(true);

    expect(logs.at(-1)).toContain('freed service port(s)');

    let server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(first.port, '127.0.0.1', resolve);
    });
    await new Promise<void>(resolve => server.close(() => resolve()));

    logs.length = 0;
    await clearServicePorts([first.port, second.port], cwd, text => logs.push(text));
    expect(logs).toEqual([]);
  } finally {
    for (let { child } of [first, second, unrelated]) commands.signalTree(child, 'SIGKILL');
  }
});

test('force kills a listener that ignores SIGTERM and waits for the port to be free', async () => {
  let cwd = temporary();
  let { child, port } = await listenerFixture(cwd, true);
  let logs: string[] = [];

  try {
    await clearServicePorts([port], cwd, text => logs.push(text));

    expect(logs.some(line => line.includes('SIGTERM'))).toBe(true);
    expect(logs.some(line => line.includes('SIGKILL'))).toBe(true);
    expect(await listeningProcesses([port], cwd)).toEqual([]);
  } finally {
    commands.signalTree(child, 'SIGKILL');
  }
}, 10_000);

test('preserves listeners in a managed process group', async () => {
  let cwd = temporary();
  let { child, port } = await listenerFixture(cwd);
  let logs: string[] = [];

  try {
    await clearServicePorts(
      [port],
      cwd,
      text => logs.push(text),
      () => [child.pid!]
    );

    expect(logs).toEqual([]);
    expect((await listeningProcesses([port], cwd))[0]?.pid).toBe(child.pid!);
  } finally {
    commands.signalTree(child, 'SIGKILL');
  }
});

test('reports inspection failures instead of treating them as a free port', async () => {
  let cwd = temporary();
  let spawn = commands.spawn;
  let inspect = spyOn(commands, 'spawn').mockImplementation(() =>
    spawn(
      process.execPath,
      ['-e', "console.error('cannot inspect sockets'); process.exit(1)"],
      cwd,
      {},
      false,
      true
    )
  );

  try {
    await expect(clearServicePorts([12345], cwd, () => {})).rejects.toThrow(
      'cannot inspect sockets'
    );
  } finally {
    inspect.mockRestore();
  }
});
