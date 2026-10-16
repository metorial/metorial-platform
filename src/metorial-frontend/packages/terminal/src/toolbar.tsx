import { Badge, Button, confirm, Menu, theme, Tooltip, type MenuItem } from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiClipboardLine,
  RiEraserLine,
  RiFileCopyLine,
  RiFontSize,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiShutDownLine
} from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { getStatusLabel, getStatusTone, isSessionAlive, isSessionInteractive } from './state';
import { TERMINAL_FONT_SIZES, terminalSurface } from './theme';
import type { TerminalSignal } from './types';
import type { TerminalController } from './useTerminalController';

let Bar = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 8px 6px 10px;
  flex-shrink: 0;
  background: ${terminalSurface.surface};
  color: ${terminalSurface.foreground};
  font-size: 12px;
  font-weight: 500;
`;

let Start = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

let End = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

let Divider = styled.span`
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: ${terminalSurface.control};
`;

let ToolbarButton = styled(Button)<{ $destructive?: boolean }>`
  && {
    background: transparent;
    border-color: ${terminalSurface.control};
    color: ${p => (p.$destructive ? theme.colors.red700 : terminalSurface.muted)} !important;
    box-shadow: none;

    &:not(:disabled):hover,
    &:not(:disabled):focus {
      background: ${terminalSurface.border};
      border-color: ${terminalSurface.controlActive};
      color: ${p =>
        p.$destructive ? theme.colors.red600 : terminalSurface.foreground} !important;
      box-shadow: none;
    }

    &:focus-visible {
      outline: 2px solid ${terminalSurface.controlActive};
      outline-offset: 1px;
    }

    &:disabled {
      opacity: 0.5;
    }
  }
`;

let EmptyIcon = styled.span`
  display: block;
  width: 16px;
  height: 16px;
`;

let signalItems: { signal: TerminalSignal; label: string; description: string }[] = [
  { signal: 'INT', label: 'Interrupt', description: 'SIGINT, same as Ctrl-C' },
  { signal: 'TERM', label: 'Terminate', description: 'SIGTERM, ask the process to exit' },
  { signal: 'KILL', label: 'Kill', description: 'SIGKILL, stop the process immediately' },
  { signal: 'HUP', label: 'Hang Up', description: 'SIGHUP' },
  { signal: 'QUIT', label: 'Quit', description: 'SIGQUIT, same as Ctrl-\\' }
];

let badgeTone = {
  connected: 'connected',
  pending: 'review',
  inactive: 'available',
  failed: 'available'
} as const;

let ToolButton = ({
  label,
  icon,
  ...props
}: {
  label: string;
  icon: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, 'children' | 'iconLeft'>) => (
  <Tooltip content={label}>
    <ToolbarButton
      type="button"
      $destructive={props.color == 'red'}
      size="1"
      variant="outline"
      aria-label={label}
      iconLeft={icon}
      {...props}
    />
  </Tooltip>
);

export let TerminalToolbar = ({
  controller,
  fontSize,
  onFontSizeChange,
  isFullscreen,
  onFullscreenChange,
  start,
  end
}: {
  controller: TerminalController;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  isFullscreen: boolean;
  onFullscreenChange: (isFullscreen: boolean) => void;
  start?: React.ReactNode;
  end?: React.ReactNode;
}) => {
  let { state } = controller;
  let interactive = isSessionInteractive(state.status);
  let alive = isSessionAlive(state.status);

  let fontSizeItems: MenuItem[] = TERMINAL_FONT_SIZES.map(size => ({
    id: String(size),
    label: `${size} px`,
    icon: size == fontSize ? <RiCheckLine /> : <EmptyIcon />,
    onClick: () => {
      onFontSizeChange(size);
      controller.focusAfterMenu();
    }
  }));

  let signalMenuItems: MenuItem[] = signalItems.map(item => ({
    id: item.signal,
    label: item.label,
    description: item.description,
    onClick: () => controller.sendSignal(item.signal)
  }));

  let endSession = () =>
    confirm({
      title: 'End Session',
      description:
        'This closes the shell and stops every process that is still running in it. The session cannot be resumed afterwards.',
      confirmText: 'End Session',
      onConfirm: controller.endSession
    });

  return (
    <Bar>
      <Start>{start}</Start>

      <End>
        <Badge
          variant="connection"
          size="2"
          tone={badgeTone[getStatusTone(state.status)]}
          style={{ background: 'transparent', borderColor: terminalSurface.control }}
        >
          {getStatusLabel(state)}
        </Badge>

        <Menu items={signalMenuItems} title="Send Signal" disabled={!interactive}>
          <ToolbarButton
            type="button"
            size="1"
            variant="outline"
            iconRight={<RiArrowDownSLine />}
            disabled={!interactive}
          >
            Send Signal
          </ToolbarButton>
        </Menu>

        <Divider />

        <ToolButton
          label="Copy Selection"
          icon={<RiFileCopyLine />}
          disabled={!controller.hasSelection}
          onClick={controller.copySelection}
        />

        <ToolButton
          label="Paste"
          icon={<RiClipboardLine />}
          disabled={!interactive}
          onClick={controller.paste}
        />

        <ToolButton label="Clear" icon={<RiEraserLine />} onClick={controller.clear} />

        <Tooltip content="Font Size">
          <Menu items={fontSizeItems} title="Font Size" label="Font Size">
            <ToolbarButton
              type="button"
              size="1"
              variant="outline"
              aria-label="Font Size"
              iconLeft={<RiFontSize />}
            />
          </Menu>
        </Tooltip>

        <ToolButton
          label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          icon={isFullscreen ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
          onClick={() => {
            onFullscreenChange(!isFullscreen);
            controller.focus();
          }}
        />

        <Divider />

        <ToolButton
          label="End Session"
          icon={<RiShutDownLine />}
          color="red"
          disabled={!alive}
          onClick={endSession}
        />

        {end}
      </End>
    </Bar>
  );
};
