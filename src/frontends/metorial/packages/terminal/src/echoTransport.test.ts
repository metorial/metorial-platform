import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEchoTransport } from './echoTransport';
import type { TerminalSessionHandlers } from './types';

let decoder = new TextDecoder();

let createHandlers = () => {
  let output = '';

  let handlers = {
    onOutput: vi.fn((data: Uint8Array) => {
      output += decoder.decode(data);
    }),
    onStatus: vi.fn(),
    onExit: vi.fn(),
    onNotice: vi.fn()
  } satisfies TerminalSessionHandlers;

  return { handlers, output: () => output };
};

let statuses = (handlers: ReturnType<typeof createHandlers>['handlers']) =>
  handlers.onStatus.mock.calls.map(call => call[0]);

describe('echo transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects, prints a prompt and echoes typed lines', () => {
    let transport = createEchoTransport({ connectDelayMs: 50, prompt: '> ', banner: 'hi' });
    let { handlers, output } = createHandlers();

    let session = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, handlers);
    expect(statuses(handlers)).toEqual(['connecting']);

    vi.advanceTimersByTime(50);
    expect(statuses(handlers)).toEqual(['connecting', 'connected']);
    expect(output()).toBe('hi\r\n> ');

    session.write('lx\x7fs\r');
    expect(output()).toBe('hi\r\n> lx\b \bs\r\nls\r\n> ');
  });

  it('does not repeat earlier output when the same handle reconnects', () => {
    let transport = createEchoTransport({ connectDelayMs: 0, prompt: '$ ', banner: 'hi' });
    let { handlers, output } = createHandlers();

    let session = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, handlers);
    vi.advanceTimersByTime(0);
    session.reconnect();
    vi.advanceTimersByTime(0);

    expect(output()).toBe('hi\r\n$ ');
    expect(statuses(handlers)).toEqual([
      'connecting',
      'connected',
      'reconnecting',
      'connected'
    ]);
  });

  it('reports waking on the first connect when asked to', () => {
    let transport = createEchoTransport({ connectDelayMs: 10, waking: true });
    let { handlers } = createHandlers();

    let session = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, handlers);
    vi.advanceTimersByTime(10);
    session.reconnect();

    expect(statuses(handlers)).toEqual(['waking', 'connected', 'reconnecting']);
  });

  it('resumes a detached session and replays its output unless fresh is requested', () => {
    let transport = createEchoTransport({ connectDelayMs: 0, prompt: '$ ', banner: 'hi' });
    let first = createHandlers();

    let session = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, first.handlers);
    vi.advanceTimersByTime(0);
    session.write('pwd\r');
    session.detach();

    let resumed = createHandlers();
    transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, resumed.handlers);
    vi.advanceTimersByTime(0);

    expect(resumed.output()).toBe(first.output());

    let fresh = createHandlers();
    transport.open({ sessionKey: 'a', cols: 80, rows: 24, fresh: true }, fresh.handlers);
    vi.advanceTimersByTime(0);

    expect(fresh.output()).toBe('hi\r\n$ ');
  });

  it('exits on "exit" and on fatal signals', () => {
    let transport = createEchoTransport({ connectDelayMs: 0 });

    let exited = createHandlers();
    let first = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, exited.handlers);
    vi.advanceTimersByTime(0);
    first.write('exit\r');

    expect(exited.handlers.onExit).toHaveBeenCalledWith({ code: 0, signal: null });
    expect(statuses(exited.handlers).at(-1)).toBe('ended');

    let killed = createHandlers();
    let second = transport.open({ sessionKey: 'b', cols: 80, rows: 24 }, killed.handlers);
    vi.advanceTimersByTime(0);
    second.signal('INT');
    second.signal('KILL');

    expect(killed.output()).toContain('^C');
    expect(killed.handlers.onExit).toHaveBeenCalledWith({ code: null, signal: 'SIGKILL' });
  });

  it('stops talking to the handlers after detach and close', () => {
    let transport = createEchoTransport({ connectDelayMs: 20 });
    let { handlers } = createHandlers();

    let session = transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, handlers);
    session.detach();
    vi.advanceTimersByTime(100);

    expect(statuses(handlers)).toEqual(['connecting']);
    expect(handlers.onOutput).not.toHaveBeenCalled();

    session.close();
    session.write('ls\r');
    session.reconnect();
    vi.advanceTimersByTime(100);

    expect(statuses(handlers)).toEqual(['connecting']);
  });
});
