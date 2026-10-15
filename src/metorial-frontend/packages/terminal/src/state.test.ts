import { describe, expect, it } from 'vitest';
import {
  describeSessionEnd,
  getStatusLabel,
  initialTerminalConnectionState,
  terminalConnectionReducer,
  type TerminalConnectionEvent,
  type TerminalConnectionState
} from './state';

let run = (
  events: TerminalConnectionEvent[],
  state: TerminalConnectionState = initialTerminalConnectionState
) => events.reduce(terminalConnectionReducer, state);

let connected = run([{ type: 'status', status: 'connected' }]);

describe('terminal connection state', () => {
  it('starts connecting and remembers that a connection was established', () => {
    expect(initialTerminalConnectionState.status).toBe('connecting');
    expect(initialTerminalConnectionState.hasConnected).toBe(false);

    let state = run([
      { type: 'status', status: 'waking' },
      { type: 'status', status: 'connected' },
      { type: 'status', status: 'reconnecting' }
    ]);

    expect(state.status).toBe('reconnecting');
    expect(state.hasConnected).toBe(true);
  });

  it('keeps the error detail and replaces it on the next status', () => {
    let failed = run([
      { type: 'status', status: 'error', detail: { message: 'Open elsewhere', code: 4409 } }
    ]);

    expect(failed.detail).toEqual({ message: 'Open elsewhere', code: 4409 });
    expect(getStatusLabel(failed)).toBe('Connection Failed');

    let retried = run([{ type: 'status', status: 'reconnecting' }], failed);
    expect(retried.detail).toBeNull();

    let lost = run([{ type: 'status', status: 'error' }], connected);
    expect(getStatusLabel(lost)).toBe('Disconnected');
  });

  it('ends on exit and ignores later connection updates until reset', () => {
    let ended = run(
      [
        { type: 'notice', notice: { kind: 'idle_warning', message: 'Idle soon' } },
        { type: 'exit', exit: { code: 2, signal: null } },
        { type: 'status', status: 'reconnecting' },
        { type: 'status', status: 'error', detail: { message: 'Socket closed' } }
      ],
      connected
    );

    expect(ended.status).toBe('ended');
    expect(ended.exit).toEqual({ code: 2, signal: null });
    expect(ended.notice).toBeNull();
    expect(describeSessionEnd(ended)).toBe('The session exited with code 2.');

    expect(run([{ type: 'reset' }], ended)).toEqual(initialTerminalConnectionState);
  });

  it('records an exit that arrives after the ended status', () => {
    let state = run(
      [
        { type: 'status', status: 'ended' },
        { type: 'exit', exit: { code: null, signal: 'KILL' } },
        { type: 'exit', exit: { code: 0, signal: null } }
      ],
      connected
    );

    expect(state.exit).toEqual({ code: null, signal: 'KILL' });
    expect(describeSessionEnd(state)).toBe('The session was terminated by SIGKILL.');
  });

  it('describes an ended session without exit information', () => {
    let closed = run([{ type: 'closed' }], connected);
    expect(closed.status).toBe('ended');
    expect(describeSessionEnd(closed)).toBe('The session has ended.');

    let expired = run(
      [{ type: 'status', status: 'ended', detail: { message: 'The session expired.' } }],
      connected
    );
    expect(describeSessionEnd(expired)).toBe('The session expired.');

    let clean = run([{ type: 'exit', exit: { code: 0, signal: null } }], connected);
    expect(describeSessionEnd(clean)).toBe('The session exited normally.');
  });

  it('clears idle notices on input but keeps informational ones', () => {
    let idle = run(
      [{ type: 'notice', notice: { kind: 'idle_warning', message: 'Idle soon' } }],
      connected
    );
    expect(run([{ type: 'input' }], idle).notice).toBeNull();

    let info = run(
      [{ type: 'notice', notice: { kind: 'info', message: 'Machine upgraded' } }],
      connected
    );
    expect(run([{ type: 'input' }], info).notice?.kind).toBe('info');
    expect(run([{ type: 'notice_clear' }], info).notice).toBeNull();
  });

  it('drops stale connection notices once reconnected', () => {
    let closing = run(
      [
        { type: 'notice', notice: { kind: 'closing', message: 'Closed while idle' } },
        { type: 'status', status: 'reconnecting' }
      ],
      connected
    );
    expect(closing.notice?.kind).toBe('closing');

    expect(run([{ type: 'status', status: 'connected' }], closing).notice).toBeNull();
  });
});
