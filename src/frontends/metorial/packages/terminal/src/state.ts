import type {
  TerminalExit,
  TerminalNotice,
  TerminalStatus,
  TerminalStatusDetail
} from './types';

export interface TerminalConnectionState {
  status: TerminalStatus;
  detail: TerminalStatusDetail | null;
  exit: TerminalExit | null;
  notice: TerminalNotice | null;
  hasConnected: boolean;
}

export type TerminalConnectionEvent =
  | { type: 'status'; status: TerminalStatus; detail?: TerminalStatusDetail }
  | { type: 'exit'; exit: TerminalExit }
  | { type: 'notice'; notice: TerminalNotice }
  | { type: 'notice_clear' }
  | { type: 'input' }
  | { type: 'closed' }
  | { type: 'reset' };

export type TerminalStatusTone = 'connected' | 'pending' | 'inactive' | 'failed';

export let initialTerminalConnectionState: TerminalConnectionState = {
  status: 'connecting',
  detail: null,
  exit: null,
  notice: null,
  hasConnected: false
};

let idleNoticeKinds = new Set<TerminalNotice['kind']>(['idle_warning', 'idle']);

let endState = (state: TerminalConnectionState, exit: TerminalExit | null) => ({
  ...state,
  status: 'ended' as const,
  exit,
  notice: null
});

export let terminalConnectionReducer = (
  state: TerminalConnectionState,
  event: TerminalConnectionEvent
): TerminalConnectionState => {
  if (event.type == 'reset') return initialTerminalConnectionState;

  if (state.status == 'ended') {
    return event.type == 'exit' && !state.exit ? { ...state, exit: event.exit } : state;
  }

  switch (event.type) {
    case 'status': {
      if (event.status == 'ended') {
        return { ...endState(state, state.exit), detail: event.detail ?? null };
      }

      let isReconnected = event.status == 'connected' && state.status != 'connected';

      return {
        ...state,
        status: event.status,
        detail: event.detail ?? null,
        hasConnected: state.hasConnected || event.status == 'connected',
        notice: isReconnected && state.notice?.kind != 'info' ? null : state.notice
      };
    }

    case 'exit':
      return endState(state, event.exit);

    case 'closed':
      return endState(state, state.exit);

    case 'notice':
      return { ...state, notice: event.notice };

    case 'notice_clear':
      return state.notice ? { ...state, notice: null } : state;

    case 'input':
      return state.notice && idleNoticeKinds.has(state.notice.kind)
        ? { ...state, notice: null }
        : state;
  }
};

export let getStatusLabel = (
  state: Pick<TerminalConnectionState, 'status' | 'hasConnected'>
) => {
  switch (state.status) {
    case 'connecting':
      return 'Connecting';
    case 'waking':
      return 'Waking Machine';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting';
    case 'ended':
      return 'Ended';
    case 'error':
      return state.hasConnected ? 'Disconnected' : 'Connection Failed';
  }
};

export let getStatusTone = (status: TerminalStatus): TerminalStatusTone => {
  if (status == 'connected') return 'connected';
  if (status == 'error') return 'failed';
  if (status == 'ended') return 'inactive';
  return 'pending';
};

export let isSessionInteractive = (status: TerminalStatus) => status == 'connected';

export let isSessionAlive = (status: TerminalStatus) => status != 'ended';

export let describeSessionEnd = (state: Pick<TerminalConnectionState, 'exit' | 'detail'>) => {
  let { exit, detail } = state;

  if (exit?.signal) return `The session was terminated by ${formatSignal(exit.signal)}.`;
  if (exit?.code === 0) return 'The session exited normally.';
  if (exit?.code != null) return `The session exited with code ${exit.code}.`;

  return detail?.message ?? 'The session has ended.';
};

let formatSignal = (signal: string) => {
  let upper = signal.toUpperCase();
  return upper.startsWith('SIG') ? upper : `SIG${upper}`;
};
