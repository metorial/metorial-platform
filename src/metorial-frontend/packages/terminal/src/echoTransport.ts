import type {
  TerminalExit,
  TerminalSession,
  TerminalSignal,
  TerminalTransport
} from './types';

let MAX_TRANSCRIPT_LENGTH = 64 * 1024;

export interface EchoTransportOptions {
  connectDelayMs?: number;
  prompt?: string;
  banner?: string;
  waking?: boolean;
}

interface EchoSessionRecord {
  transcript: string;
  line: string;
}

let escapeSequencePattern = /\x1b(\[[0-9;?]*[ -/]*[@-~]|O[@-~]|[@-Z\\-_])/g;

let encoder = new TextEncoder();
let decoder = new TextDecoder();

export let createEchoTransport = (opts: EchoTransportOptions = {}): TerminalTransport => {
  let connectDelayMs = opts.connectDelayMs ?? 150;
  let prompt = opts.prompt ?? '$ ';
  let banner = opts.banner ?? 'Echo terminal. Type "exit" or press Ctrl-D to end the session.';

  let records = new Map<string, EchoSessionRecord>();

  return {
    open: ({ sessionKey, fresh }, handlers): TerminalSession => {
      let record = (!fresh && records.get(sessionKey)) || { transcript: '', line: '' };
      records.set(sessionKey, record);

      let attached = false;
      let ended = false;
      let isFirstConnect = true;
      let hasDeliveredOutput = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      let clearTimer = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };

      let emit = (text: string) => {
        record.transcript = (record.transcript + text).slice(-MAX_TRANSCRIPT_LENGTH);
        if (attached) handlers.onOutput(encoder.encode(text));
      };

      let finish = (exit: TerminalExit) => {
        clearTimer();
        ended = true;
        attached = false;
        records.delete(sessionKey);

        handlers.onExit(exit);
        handlers.onStatus('ended');
      };

      let connect = (status: 'connecting' | 'reconnecting') => {
        clearTimer();
        attached = false;

        handlers.onStatus(isFirstConnect && opts.waking ? 'waking' : status);
        isFirstConnect = false;

        timer = setTimeout(() => {
          timer = null;
          attached = true;
          handlers.onStatus('connected');

          if (hasDeliveredOutput) return;
          hasDeliveredOutput = true;

          if (record.transcript) handlers.onOutput(encoder.encode(record.transcript));
          else emit(`${banner}\r\n${prompt}`);
        }, connectDelayMs);
      };

      let runLine = (line: string) => {
        let command = line.trim();

        if (command == 'exit') return finish({ code: 0, signal: null });
        if (command == 'clear') return emit(`\x1b[2J\x1b[3J\x1b[H${prompt}`);
        if (!command) return emit(prompt);

        emit(`${line}\r\n${prompt}`);
      };

      let interrupt = () => {
        record.line = '';
        emit(`^C\r\n${prompt}`);
      };

      let handleInput = (text: string) => {
        for (let char of text.replace(escapeSequencePattern, '')) {
          if (ended) return;

          if (char == '\r') {
            let line = record.line;
            record.line = '';

            emit('\r\n');
            runLine(line);
          } else if (char == '\x7f') {
            if (!record.line) continue;

            record.line = record.line.slice(0, -1);
            emit('\b \b');
          } else if (char == '\x03') {
            interrupt();
          } else if (char == '\x04') {
            if (!record.line) finish({ code: 0, signal: null });
          } else if (char >= ' ') {
            record.line += char;
            emit(char);
          }
        }
      };

      connect('connecting');

      return {
        write: data => {
          if (!attached || ended) return;
          handleInput(typeof data == 'string' ? data : decoder.decode(data));
        },

        resize: () => {},

        signal: (signal: TerminalSignal) => {
          if (!attached || ended) return;

          if (signal == 'INT') interrupt();
          else finish({ code: null, signal: `SIG${signal}` });
        },

        reconnect: () => {
          if (!ended) connect('reconnecting');
        },

        detach: () => {
          clearTimer();
          attached = false;
        },

        close: () => {
          clearTimer();
          ended = true;
          attached = false;
          records.delete(sessionKey);
        }
      };
    }
  };
};
