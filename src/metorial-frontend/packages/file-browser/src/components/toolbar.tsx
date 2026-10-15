import { Button, Menu, theme, Tooltip, type MenuItem } from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiArrowUpLine,
  RiDownload2Line,
  RiLayoutLeftLine,
  RiMore2Line,
  RiRefreshLine,
  RiUpload2Line
} from '@remixicon/react';
import type { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { PathBar } from './pathBar';

let spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

let Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Group = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
`;

let SpinWrap = styled.span`
  display: inline-flex;

  &[data-spinning='true'] {
    animation: ${spin} 0.9s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-spinning='true'] {
      animation: none;
    }
  }
`;

export interface FileBrowserToolbarProps {
  path: string;
  rootPath: string;
  disabled?: boolean;
  readOnly?: boolean;
  writeDisabled?: boolean;
  canGoUp: boolean;
  refreshing: boolean;
  showHidden: boolean;
  treeAvailable: boolean;
  treeOpen: boolean;
  canDownload: boolean;
  extra?: ReactNode;
  onNavigate: (path: string) => void;
  onUp: () => void;
  onRefresh: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onToggleHidden: () => void;
  onToggleTree: () => void;
}

export let FileBrowserToolbar = (p: FileBrowserToolbarProps) => {
  let newItems: MenuItem[] = [
    { id: 'new-file', label: 'New File', onClick: p.onNewFile },
    { id: 'new-folder', label: 'New Folder', onClick: p.onNewFolder }
  ];

  let moreItems: MenuItem[] = [
    {
      id: 'toggle-hidden',
      label: p.showHidden ? 'Hide Hidden Files' : 'Show Hidden Files',
      onClick: p.onToggleHidden
    }
  ];

  return (
    <Bar role="toolbar" aria-label="File actions">
      <Group>
        {p.treeAvailable ? (
          <Tooltip content={p.treeOpen ? 'Hide Folders' : 'Show Folders'}>
            <Button
              type="button"
              size="2"
              variant="outline"
              aria-label={p.treeOpen ? 'Hide Folders' : 'Show Folders'}
              aria-pressed={p.treeOpen}
              iconLeft={<RiLayoutLeftLine />}
              onClick={p.onToggleTree}
            />
          </Tooltip>
        ) : null}

        <Tooltip content="Up One Level">
          <Button
            type="button"
            size="2"
            variant="outline"
            aria-label="Up One Level"
            disabled={p.disabled || !p.canGoUp}
            iconLeft={<RiArrowUpLine />}
            onClick={p.onUp}
          />
        </Tooltip>
      </Group>

      <PathBar
        path={p.path}
        rootPath={p.rootPath}
        disabled={p.disabled}
        onNavigate={p.onNavigate}
      />

      <Group>
        {p.extra}

        <Tooltip content="Download">
          <Button
            type="button"
            size="2"
            variant="outline"
            aria-label="Download"
            disabled={p.disabled || !p.canDownload}
            iconLeft={<RiDownload2Line />}
            onClick={p.onDownload}
          />
        </Tooltip>

        {!p.readOnly ? (
          <>
            <Button
              type="button"
              size="2"
              variant="outline"
              disabled={p.disabled || p.writeDisabled}
              iconLeft={<RiUpload2Line />}
              onClick={p.onUpload}
            >
              Upload
            </Button>

            <Menu items={newItems} label="New">
              <Button
                type="button"
                size="2"
                variant="outline"
                disabled={p.disabled || p.writeDisabled}
                iconRight={<RiArrowDownSLine />}
              >
                New
              </Button>
            </Menu>
          </>
        ) : null}

        <Tooltip content="Refresh">
          <Button
            type="button"
            size="2"
            variant="outline"
            aria-label="Refresh"
            disabled={p.disabled}
            iconLeft={
              <SpinWrap data-spinning={p.refreshing}>
                <RiRefreshLine />
              </SpinWrap>
            }
            onClick={p.onRefresh}
          />
        </Tooltip>

        <Menu items={moreItems} label="More Actions">
          <Button
            type="button"
            size="2"
            variant="outline"
            aria-label="More Actions"
            disabled={p.disabled}
            iconLeft={<RiMore2Line />}
          />
        </Menu>
      </Group>
    </Bar>
  );
};
