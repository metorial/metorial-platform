import '@xterm/xterm/css/xterm.css';

import { Button, Spinner, theme } from '@metorial/ui';
import { RiErrorWarningLine, RiInformationLine } from '@remixicon/react';
import React, { useState } from 'react';
import { css, styled } from 'styled-components';
import { describeSessionEnd, type TerminalConnectionState } from './state';
import { TerminalStrip } from './strip';
import {
  DEFAULT_TERMINAL_FONT_SIZE,
  TERMINAL_FONT_STYLESHEET,
  terminalSurface
} from './theme';
import { TerminalToolbar } from './toolbar';
import type { TerminalStatus, TerminalTransport } from './types';
import { useTerminalController, type TerminalController } from './useTerminalController';

let FULLSCREEN_Z_INDEX = 900;

let Wrapper = styled.div<{ $fullscreen: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: ${terminalSurface.background};
  border: 1px solid ${terminalSurface.border};
  border-radius: 8px;
  box-shadow: ${theme.shadows.small};

  ${({ $fullscreen }) =>
    $fullscreen &&
    css`
      position: fixed;
      inset: 0;
      z-index: ${FULLSCREEN_Z_INDEX};
      height: auto !important;
      border: none;
      border-radius: 0;
      box-shadow: none;
    `}
`;

let Body = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 8px 4px 6px 12px;
  background: ${terminalSurface.background};
  border-top: 1px solid ${terminalSurface.border};
`;

let Host = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  .xterm .xterm-viewport {
    background-color: ${terminalSurface.background};
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

let Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: ${terminalSurface.background};
`;

let OverlayTitle = styled.p`
  font-size: 13px;
  font-weight: 500;
  color: ${terminalSurface.foreground};
`;

let OverlayDescription = styled.p`
  margin-top: -6px;
  font-size: 12px;
  color: ${terminalSurface.dim};
`;

export interface TerminalProps {
  transport: TerminalTransport;
  sessionKey: string;
  height?: number | string;
  autoFocus?: boolean;
  copyOnSelect?: boolean;
  defaultFontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;
  onStatusChange?: (status: TerminalStatus, state: TerminalConnectionState) => void;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
}

let pendingStatuses = new Set<TerminalStatus>(['connecting', 'waking', 'reconnecting']);

let pendingCopy = {
  connecting: { title: 'Connecting…', description: undefined },
  waking: {
    title: 'Waking machine…',
    description: 'The machine is resuming. This usually takes a few seconds.'
  },
  reconnecting: { title: 'Reconnecting…', description: undefined }
};

let pendingStripCopy = {
  connecting: 'Connecting…',
  waking: 'Waking machine…',
  reconnecting: 'Connection lost. Reconnecting…'
};

let StatusStrip = ({ controller }: { controller: TerminalController }) => {
  let { state } = controller;

  if (state.status == 'error') {
    return (
      <TerminalStrip
        tone="danger"
        icon={<RiErrorWarningLine />}
        actions={
          <>
            <Button size="1" variant="outline" onClick={controller.reconnect}>
              Retry
            </Button>

            <Button size="1" variant="outline" onClick={controller.startNewSession}>
              Start New Session
            </Button>
          </>
        }
      >
        {state.detail?.message ?? 'The connection to the terminal failed.'}
      </TerminalStrip>
    );
  }

  if (state.status == 'ended') {
    return (
      <TerminalStrip
        tone="neutral"
        icon={<RiInformationLine />}
        actions={
          <Button size="1" variant="outline" onClick={controller.startNewSession}>
            Start New Session
          </Button>
        }
      >
        {describeSessionEnd(state)}
      </TerminalStrip>
    );
  }

  if (state.hasConnected && pendingStatuses.has(state.status)) {
    return (
      <TerminalStrip tone="warning" icon={<Spinner size={14} />}>
        {pendingStripCopy[state.status as keyof typeof pendingStripCopy]}
      </TerminalStrip>
    );
  }

  if (state.notice) {
    let isWarning = state.notice.kind == 'idle_warning' || state.notice.kind == 'closing';

    return (
      <TerminalStrip
        tone={isWarning ? 'warning' : 'neutral'}
        icon={<RiInformationLine />}
        onDismiss={controller.dismissNotice}
      >
        {state.notice.message}
      </TerminalStrip>
    );
  }

  return null;
};

export let Terminal = ({
  transport,
  sessionKey,
  height = 480,
  autoFocus,
  copyOnSelect,
  defaultFontSize = DEFAULT_TERMINAL_FONT_SIZE,
  onFontSizeChange,
  onStatusChange,
  toolbarStart,
  toolbarEnd
}: TerminalProps) => {
  let [fontSize, setFontSize] = useState(defaultFontSize);
  let [isFullscreen, setIsFullscreen] = useState(false);

  let controller = useTerminalController({
    transport,
    sessionKey,
    fontSize,
    autoFocus,
    copyOnSelect,
    onStatusChange
  });

  let { state } = controller;
  let showOverlay = !state.hasConnected && pendingStatuses.has(state.status);
  let overlay = pendingCopy[state.status as keyof typeof pendingCopy];

  return (
    <>
      <link rel="stylesheet" href={TERMINAL_FONT_STYLESHEET} />

      <Wrapper $fullscreen={isFullscreen} style={{ height }}>
        <TerminalToolbar
          controller={controller}
          fontSize={fontSize}
          onFontSizeChange={size => {
            setFontSize(size);
            onFontSizeChange?.(size);
          }}
          isFullscreen={isFullscreen}
          onFullscreenChange={setIsFullscreen}
          start={toolbarStart}
          end={toolbarEnd}
        />

        <Body>
          <Host ref={controller.hostRef} />

          {showOverlay && overlay && (
            <Overlay aria-live="polite">
              <Spinner
                size={18}
                foreground={terminalSurface.foreground}
                background={terminalSurface.border}
              />

              <OverlayTitle>{overlay.title}</OverlayTitle>

              {overlay.description && (
                <OverlayDescription>{overlay.description}</OverlayDescription>
              )}
            </Overlay>
          )}
        </Body>

        <StatusStrip controller={controller} />
      </Wrapper>
    </>
  );
};
