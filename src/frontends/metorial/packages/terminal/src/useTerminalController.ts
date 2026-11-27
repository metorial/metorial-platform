import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm, type IDisposable } from '@xterm/xterm';
import { useEffect, useReducer, useRef, useState } from 'react';
import { createResizeScheduler } from './resize';
import {
  initialTerminalConnectionState,
  isSessionInteractive,
  terminalConnectionReducer,
  type TerminalConnectionEvent,
  type TerminalConnectionState
} from './state';
import { TERMINAL_FONT_FAMILY, terminalTheme } from './theme';
import type {
  TerminalSession,
  TerminalSignal,
  TerminalStatus,
  TerminalTransport
} from './types';

let RESIZE_DEBOUNCE_MS = 120;
let COPY_ON_SELECT_DELAY_MS = 150;
let SCROLLBACK_LINES = 10_000;
let HIDE_CURSOR = '\x1b[?25l';

// The ui Menu returns focus to its trigger once its exit animation (200ms) has finished, so
// focusing the terminal any earlier would immediately be undone.
let MENU_FOCUS_RESTORE_DELAY_MS = 260;

export interface TerminalControllerOptions {
  transport: TerminalTransport;
  sessionKey: string;
  fontSize: number;
  autoFocus?: boolean;
  copyOnSelect?: boolean;
  onStatusChange?: (status: TerminalStatus, state: TerminalConnectionState) => void;
}

let binaryStringToBytes = (data: string) =>
  Uint8Array.from(data, char => char.charCodeAt(0) & 0xff);

let writeClipboard = (text: string) => {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
};

export let useTerminalController = (opts: TerminalControllerOptions) => {
  let hostRef = useRef<HTMLDivElement>(null);
  let termRef = useRef<XTerm | null>(null);
  let fitSoonRef = useRef<() => void>(() => {});
  let sessionRef = useRef<TerminalSession | null>(null);
  let closedRef = useRef(false);
  let endedRef = useRef(false);

  let optionsRef = useRef(opts);
  optionsRef.current = opts;

  let [state, dispatch] = useReducer(
    terminalConnectionReducer,
    initialTerminalConnectionState
  );
  let [openRequest, setOpenRequest] = useState({ generation: 0, fresh: false });
  let [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    let host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let fitFrame = 0;
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    let term = new XTerm({
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: optionsRef.current.fontSize,
      lineHeight: 1.2,
      theme: terminalTheme,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline',
      scrollback: SCROLLBACK_LINES,
      disableStdin: true
    });

    let fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    let fitNow = () => {
      if (disposed || !host.clientWidth || !host.clientHeight) return;
      fit.fit();
    };

    let fitSoon = () => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(fitNow);
    };

    fitNow();
    fitSoonRef.current = fitSoon;

    let observer = new ResizeObserver(fitSoon);
    observer.observe(host);

    // xterm measures its cell size once per font change. When the web font arrives after the
    // terminal opened, toggling the family forces a re-measure so the grid matches the glyphs.
    let fonts = typeof document != 'undefined' ? document.fonts : undefined;
    let remeasureFont = () => {
      if (disposed) return;

      term.options.fontFamily = 'monospace';
      term.options.fontFamily = TERMINAL_FONT_FAMILY;
      fitSoon();
    };

    fonts?.addEventListener('loadingdone', remeasureFont);
    fonts?.ready.then(remeasureFont);

    let selectionSubscription = term.onSelectionChange(() => {
      let selected = term.hasSelection();
      setHasSelection(selected);

      if (!selected || !optionsRef.current.copyOnSelect) return;

      clearTimeout(copyTimer);
      copyTimer = setTimeout(
        () => writeClipboard(term.getSelection()),
        COPY_ON_SELECT_DELAY_MS
      );
    });

    termRef.current = term;

    return () => {
      disposed = true;

      cancelAnimationFrame(fitFrame);
      clearTimeout(copyTimer);
      observer.disconnect();
      fonts?.removeEventListener('loadingdone', remeasureFont);

      selectionSubscription.dispose();
      term.dispose();

      termRef.current = null;
      fitSoonRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    let term = termRef.current;
    if (!term) return;

    let disposed = false;
    closedRef.current = false;
    endedRef.current = false;

    term.reset();
    dispatch({ type: 'reset' });

    let send = (event: TerminalConnectionEvent) => {
      if (!disposed) dispatch(event);
    };

    let session = opts.transport.open(
      {
        sessionKey: opts.sessionKey,
        cols: term.cols,
        rows: term.rows,
        ...(openRequest.fresh && { fresh: true })
      },
      {
        onOutput: data => {
          if (!disposed) term.write(data);
        },
        onStatus: (status, detail) => send({ type: 'status', status, detail }),
        onExit: exit => send({ type: 'exit', exit }),
        onNotice: notice => send({ type: 'notice', notice }),
        onNoticeClear: () => send({ type: 'notice_clear' })
      }
    );

    sessionRef.current = session;

    let resizer = createResizeScheduler({
      delayMs: RESIZE_DEBOUNCE_MS,
      initial: { cols: term.cols, rows: term.rows },
      onResize: size => {
        if (!endedRef.current) session.resize(size.cols, size.rows);
      }
    });

    let subscriptions: IDisposable[] = [
      term.onData(data => {
        session.write(data);
        send({ type: 'input' });
      }),

      term.onBinary(data => session.write(binaryStringToBytes(data))),

      term.onResize(size => resizer.schedule(size))
    ];

    if (optionsRef.current.autoFocus) term.focus();

    return () => {
      disposed = true;

      resizer.cancel();
      subscriptions.forEach(subscription => subscription.dispose());

      if (sessionRef.current == session) sessionRef.current = null;
      if (!closedRef.current) session.detach();
    };
  }, [opts.transport, opts.sessionKey, openRequest]);

  useEffect(() => {
    let term = termRef.current;
    if (!term) return;

    let interactive = isSessionInteractive(state.status);
    term.options.disableStdin = !interactive;
    term.options.cursorBlink = interactive;

    endedRef.current = state.status == 'ended';
    if (endedRef.current) term.write(HIDE_CURSOR);
  }, [state.status]);

  useEffect(() => {
    optionsRef.current.onStatusChange?.(state.status, state);
  }, [state.status]);

  useEffect(() => {
    let term = termRef.current;
    if (!term || term.options.fontSize == opts.fontSize) return;

    term.options.fontSize = opts.fontSize;
    fitSoonRef.current();
  }, [opts.fontSize]);

  let focus = () => termRef.current?.focus();

  let focusAfterMenu = () => setTimeout(focus, MENU_FOCUS_RESTORE_DELAY_MS);

  return {
    hostRef,
    state,
    hasSelection,

    focus,
    fit: () => fitSoonRef.current(),

    clear: () => {
      termRef.current?.clear();
      focus();
    },

    copySelection: () => {
      writeClipboard(termRef.current?.getSelection() ?? '');
      focus();
    },

    paste: async () => {
      let text = await navigator.clipboard?.readText().catch(() => '');
      if (text) termRef.current?.paste(text);
      focus();
    },

    sendSignal: (signal: TerminalSignal) => {
      sessionRef.current?.signal(signal);
      focusAfterMenu();
    },

    focusAfterMenu,

    dismissNotice: () => dispatch({ type: 'notice_clear' }),

    reconnect: () => {
      dispatch({ type: 'status', status: 'reconnecting' });
      sessionRef.current?.reconnect();
      focus();
    },

    endSession: () => {
      closedRef.current = true;
      endedRef.current = true;
      sessionRef.current?.close();
      dispatch({ type: 'closed' });
    },

    startNewSession: () => {
      setOpenRequest(current => ({ generation: current.generation + 1, fresh: true }));
      focus();
    }
  };
};

export type TerminalController = ReturnType<typeof useTerminalController>;
