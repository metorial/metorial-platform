import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = {
  machine: { access: { createToken: vi.fn() } }
};

let fabricFire = vi.hoisted(() => vi.fn());

vi.mock('../src/env', () => ({ env: { genesis: {} } }));
vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: fabricFire } }));

let { runMachineExec } = await import('../src/lib/machineExec');
let { sandboxMachineAccessService } = await import('../src/services/machineAccess');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'us-east-1' };
let tenant = { oid: 100n, id: 'sbt_1', slug: 'p', region } as any;
let machine = { oid: 5n, id: 'sbm_1', status: 'active', tenant } as any;

let textEncoder = new TextEncoder();

class FakeSocket {
  static last: FakeSocket;

  binaryType = 'blob';
  sent: any[] = [];
  closed = false;
  listeners: Record<string, ((event: any) => void)[]> = {};

  constructor(
    public url: string,
    public protocols: string[]
  ) {
    FakeSocket.last = this;
  }

  addEventListener(type: string, listener: (event: any) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closed = true;
  }

  emit(type: string, event: any = {}) {
    for (let listener of this.listeners[type] ?? []) listener(event);
  }

  text(message: Record<string, unknown>) {
    this.emit('message', { data: JSON.stringify(message) });
  }

  output(tag: number, payload: Uint8Array | string, id = 'exec') {
    let idBytes = textEncoder.encode(id);
    let bytes = typeof payload == 'string' ? textEncoder.encode(payload) : payload;
    let frame = new Uint8Array(2 + idBytes.length + bytes.length);

    frame[0] = idBytes.length;
    frame.set(idBytes, 1);
    frame[1 + idBytes.length] = tag;
    frame.set(bytes, 2 + idBytes.length);

    this.emit('message', { data: frame.buffer });
  }
}

let waitForSocket = async <T>(pending: Promise<T>) => {
  pending.catch(() => {});

  await vi.waitFor(() => expect(FakeSocket.last).toBeDefined());

  return { pending, socket: FakeSocket.last };
};

let startExec = (input: Partial<Parameters<typeof runMachineExec>[0]> = {}) =>
  waitForSocket(
    runMachineExec({
      url: 'wss://machine/exec',
      token: 'tok',
      command: 'echo hi',
      timeoutMs: 60_000,
      deadlineMs: 180_000,
      ...input
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('WebSocket', FakeSocket);

  FakeSocket.last = undefined as any;
  genesis.machine.access.createToken.mockResolvedValue({
    token: 'tok',
    urls: { exec: 'wss://machine/exec' }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('runMachineExec', () => {
  it('runs the command over the exec socket and collects its output', async () => {
    let { pending, socket } = await startExec({
      cwd: '/srv',
      env: { A: '1' },
      timeoutMs: 30_000
    });

    expect(socket.url).toBe('wss://machine/exec');
    expect(socket.protocols).toEqual(['metorial-sandbox-v1', 'metorial-sandbox-token.tok']);
    expect(socket.binaryType).toBe('arraybuffer');

    socket.emit('open');

    expect(socket.sent).toEqual([
      {
        id: 'exec',
        op: 'run',
        v: 1,
        command: ['/bin/sh', '-c', 'echo hi'],
        cwd: '/srv',
        env: { A: '1' },
        timeoutMs: 30000
      }
    ]);

    socket.text({ id: 'exec', type: 'started', pid: 12 });
    socket.output(1, 'hel');
    socket.output(1, 'lo\n');
    socket.output(2, 'warn\n');
    socket.output(1, 'other', 'someone-else');
    socket.text({ id: 'exec', type: 'exit', code: 3, signal: null, timedOut: false });

    await expect(pending).resolves.toEqual({
      exitCode: 3,
      signal: null,
      timedOut: false,
      stdout: 'hello\n',
      stderr: 'warn\n',
      stdoutTruncated: false,
      stderrTruncated: false
    });
    expect(socket.closed).toBe(true);
  });

  it('reports a command stopped by its timeout', async () => {
    let { pending, socket } = await startExec();

    socket.emit('open');
    socket.text({ id: 'exec', type: 'exit', code: null, signal: 'KILL', timedOut: true });

    await expect(pending).resolves.toMatchObject({
      exitCode: null,
      signal: 'KILL',
      timedOut: true
    });
  });

  it('caps each stream at 1 MiB and keeps draining', async () => {
    let { pending, socket } = await startExec();

    socket.emit('open');
    socket.output(1, new Uint8Array(700 * 1024).fill(97));
    socket.output(1, new Uint8Array(700 * 1024).fill(98));
    socket.output(1, 'more');
    socket.output(2, 'small');
    socket.text({ id: 'exec', type: 'exit', code: 0, signal: null, timedOut: false });

    let result = await pending;

    expect(result.stdout).toHaveLength(1024 * 1024);
    expect(result.stdout.endsWith('b')).toBe(true);
    expect(result.stdoutTruncated).toBe(true);
    expect(result.stderr).toBe('small');
    expect(result.stderrTruncated).toBe(false);
  });

  it('does not emit a partial character when truncating multi-byte output', async () => {
    let { pending, socket } = await startExec();

    socket.emit('open');
    socket.output(1, new Uint8Array(1024 * 1024 - 1).fill(97));
    socket.output(1, '\u00e9');
    socket.text({ id: 'exec', type: 'exit', code: 0, signal: null, timedOut: false });

    let result = await pending;

    expect(result.stdoutTruncated).toBe(true);
    expect(result.stdout.endsWith('a\ufffd')).toBe(true);
  });

  it('turns an error frame into a service error', async () => {
    let { pending, socket } = await startExec();

    socket.emit('open');
    socket.text({
      id: 'exec',
      type: 'error',
      error: { code: 'spawn_failed', message: 'no such directory' }
    });

    await expect(pending).rejects.toMatchObject({
      data: { status: 400, message: 'no such directory' }
    });
    expect(socket.closed).toBe(true);
  });

  it('fails when the connection closes before the command exits', async () => {
    let { pending, socket } = await startExec();

    socket.emit('open');
    socket.output(1, 'partial');
    socket.emit('close', { code: 1012, reason: 'machine_restarting' });

    await expect(pending).rejects.toMatchObject({
      outcome: 'disconnected',
      data: { status: 502, code: 'machine_connection_lost' }
    });
  });

  it('reports an unreachable machine when the connection closes before it opens', async () => {
    let { pending, socket } = await startExec();

    socket.emit('close', { code: 1006, reason: '' });

    await expect(pending).rejects.toMatchObject({
      outcome: 'disconnected',
      data: { status: 502, code: 'machine_unreachable' }
    });
  });

  it('stops waiting and closes the socket when the request is aborted', async () => {
    let controller = new AbortController();
    let { pending, socket } = await startExec({ signal: controller.signal });

    socket.emit('open');
    controller.abort();

    await expect(pending).rejects.toMatchObject({ outcome: 'disconnected' });
    expect(socket.closed).toBe(true);
  });

  it('gives up at the deadline', async () => {
    vi.useFakeTimers();

    let { pending, socket } = await startExec({ timeoutMs: 10_000, deadlineMs: 130_000 });

    socket.emit('open');
    await vi.advanceTimersByTimeAsync(129 * 1000);
    socket.output(1, 'still going');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(pending).rejects.toMatchObject({ data: { status: 504 } });
    expect(socket.closed).toBe(true);
  });
});

describe('sandboxMachineAccessService.execCommand', () => {
  let startCommand = (input: { command: string; timeoutSeconds?: number }) =>
    waitForSocket(
      sandboxMachineAccessService.execCommand({
        machine,
        auditScope: { type: 'test' } as any,
        input
      })
    );

  it('runs the command through a shell token sized for the timeout plus wake margin', async () => {
    let { pending, socket } = await startCommand({ command: 'echo hi', timeoutSeconds: 30 });

    expect(genesis.machine.access.createToken).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1',
      scope: 'shell',
      ports: undefined,
      ttlSeconds: 150
    });

    socket.emit('open');
    socket.text({ id: 'exec', type: 'exit', code: 0, signal: null, timedOut: false });

    await expect(pending).resolves.toMatchObject({ exitCode: 0 });
    expect(socket.sent[0].timeoutMs).toBe(30000);
  });

  it('defaults the timeout to 60 seconds', async () => {
    let { pending, socket } = await startCommand({ command: 'echo hi' });

    socket.emit('open');
    socket.text({ id: 'exec', type: 'exit', code: 0, signal: null, timedOut: false });
    await pending;

    expect(socket.sent[0].timeoutMs).toBe(60000);
    expect(genesis.machine.access.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ ttlSeconds: 180 })
    );
  });

  it('audits the run with a summary instead of the command or output', async () => {
    let { pending, socket } = await startCommand({ command: 'echo caf\u00e9' });

    socket.emit('open');
    socket.output(1, 'secret output');
    socket.text({ id: 'exec', type: 'exit', code: 2, signal: null, timedOut: false });
    await pending;

    expect(fabricFire).toHaveBeenCalledWith('sandbox.machine.exec:after', {
      auditScope: { type: 'test' },
      machine: expect.objectContaining({ id: 'sbm_1' }),
      commandByteSize: 10,
      outcome: 'exited',
      exitCode: 2,
      timedOut: false,
      durationMs: expect.any(Number)
    });
  });

  it.each([
    {
      outcome: 'rejected',
      finish: (socket: FakeSocket) =>
        socket.text({ id: 'exec', type: 'error', error: { message: 'no such directory' } })
    },
    {
      outcome: 'disconnected',
      finish: (socket: FakeSocket) => socket.emit('close', { code: 1012 })
    }
  ])(
    'audits a run that ends as $outcome without an exit code',
    async ({ outcome, finish }) => {
      let { pending, socket } = await startCommand({ command: 'echo hi' });

      socket.emit('open');
      finish(socket);

      await expect(pending).rejects.toBeDefined();
      expect(fabricFire).toHaveBeenCalledWith(
        'sandbox.machine.exec:after',
        expect.objectContaining({ outcome, exitCode: null, timedOut: false })
      );
    }
  );

  it('audits a run that hits the deadline', async () => {
    vi.useFakeTimers();

    let { pending } = await startCommand({ command: 'sleep 1000', timeoutSeconds: 10 });

    await vi.advanceTimersByTimeAsync(130 * 1000);

    await expect(pending).rejects.toMatchObject({ data: { status: 504 } });
    expect(fabricFire).toHaveBeenCalledWith(
      'sandbox.machine.exec:after',
      expect.objectContaining({ outcome: 'deadline', exitCode: null })
    );
  });
});
