import { floatingTokens, FloatingBarSeparator, NavIconButton, theme } from '@metorial/ui';
import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import styled from 'styled-components';
import { useSkillWorkspace } from './context';
import { workspaceEase } from './motion';

let Pane = styled.section<{ $attached: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${floatingTokens.border};
  border-radius: 12px;
  background: ${theme.colors.background};
  box-sizing: border-box;

  ${({ $attached }) =>
    $attached
      ? `
    position: absolute;
    top: var(--chrome-bottom, 70px);
    left: var(--canvas-left, 14px);
    right: var(--canvas-right, 14px);
    bottom: var(--pane-bottom, 14px);
    transition:
      top 0.3s ${workspaceEase},
      left 0.3s ${workspaceEase},
      right 0.3s ${workspaceEase},
      bottom 0.3s ${workspaceEase};
  `
      : `
    position: relative;
    height: 100%;
    border-width: 0;
    border-radius: 0;
  `}
`;

let Header = styled.header`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 44px;
  padding: 0 6px 0 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
  color: ${theme.colors.gray700};
  font-size: 12.5px;

  > svg {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
    color: ${theme.colors.gray650};
  }
`;

let Path = styled.span`
  min-width: 0;
  overflow: hidden;
  color: ${theme.colors.gray650};
  text-overflow: ellipsis;
  white-space: nowrap;

  b {
    color: ${theme.colors.foreground};
    font-weight: 600;
  }

  [data-size='xs'] & {
    display: none;
  }
`;

let Chip = styled.span`
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 5px;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray700};
  font-size: 11.5px;
  font-weight: 500;
`;

let Meta = styled.span`
  flex: 0 0 auto;
  color: ${theme.colors.gray600};

  [data-size='xs'] &,
  [data-size='sm'] & {
    display: none;
  }
`;

let Spacer = styled.span`
  flex: 1 1 auto;
  min-width: 8px;
`;

let Actions = styled.span`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
`;

export let FilePaneBody = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

export let FilePaneSeparator = styled(FloatingBarSeparator)`
  height: 16px;
  margin: 0 4px;
`;

export let FilePaneCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 200px;
  padding: 32px;
  box-sizing: border-box;
  text-align: center;
`;

export let FilePaneAction = (p: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string | null;
  disabled?: boolean;
  active?: boolean;
}) => {
  if (p.href) {
    return (
      <a href={p.href} download aria-label={p.label} style={{ display: 'inline-flex' }}>
        <NavIconButton icon={p.icon} label={p.label} tabIndex={-1} />
      </a>
    );
  }

  return (
    <NavIconButton
      icon={p.icon}
      label={p.label}
      onClick={p.onClick}
      disabled={p.disabled}
      active={p.active}
    />
  );
};

let splitPath = (path: string) => {
  let parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
  let name = parts.pop() ?? path;
  return { parent: parts.join('/'), name };
};

export let FilePane = (p: {
  icon: ReactNode;
  path: string;
  chip?: string | null;
  meta?: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  let workspace = useSkillWorkspace();
  let registerFilePane = workspace?.registerFilePane;
  let { parent, name } = splitPath(p.path);

  useLayoutEffect(() => registerFilePane?.(), [registerFilePane]);

  return (
    <Pane $attached={!!workspace}>
      <Header>
        {p.icon}
        <Path title={p.path}>
          {parent ? `${parent}/` : null}
          <b>{name}</b>
        </Path>
        {p.chip ? <Chip>{p.chip}</Chip> : null}
        {p.meta ? <Meta>{p.meta}</Meta> : null}
        <Spacer />
        {p.actions ? <Actions>{p.actions}</Actions> : null}
      </Header>
      {p.children}
    </Pane>
  );
};
