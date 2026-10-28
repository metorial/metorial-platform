import {
  FloatingBar,
  FloatingBarSeparator,
  FloatingMenu,
  type FloatingMenuItem,
  FloatingPopover,
  NavButton,
  NavIconButton,
  NavShareButton,
  NavTextButton,
  theme,
  Tooltip
} from '@metorial/ui';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiChat3Line,
  RiDownload2Line,
  RiEyeLine,
  RiFontSize2,
  RiGitForkLine,
  RiGitPullRequestLine,
  RiHistoryLine,
  RiMoreFill,
  RiPushpinLine,
  RiSearchLine,
  RiSettings3Line
} from '@remixicon/react';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { type WorkspaceFileEntry, WorkspaceFileIcon } from './files';
import type { WorkspaceSize } from './layout';
import { useMorphWidths, workspaceEase } from './motion';

let Cluster = styled.div<{ $side: 'left' | 'right'; $size: WorkspaceSize; $offset?: number }>`
  position: absolute;
  top: 14px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: ${({ $size }) => ($size == 'lg' || $size == 'md' ? '8px' : '6px')};
  max-width: calc(100% - 28px);
  transition: left 0.3s ${workspaceEase};

  ${({ $side, $size, $offset }) => {
    let inset = $size == 'xs' ? 8 : $size == 'sm' ? 10 : 14;
    return $side == 'left'
      ? css`
          left: ${inset + ($offset ?? 0)}px;
        `
      : css`
          right: ${inset}px;
        `;
  }}

  > * {
    flex: 0 0 auto;
  }
`;

let labelSwap = keyframes`
  from {
    opacity: 0;
    transform: translateY(3px);
  }
`;

let IconTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-left: 2px;
  padding: 4px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray250};
  }

  &:disabled {
    cursor: default;
  }
`;

let NameInput = styled.input<{ $size: WorkspaceSize }>`
  min-width: 48px;
  max-width: ${({ $size }) => ($size == 'sm' ? '120px' : '220px')};
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: ${theme.colors.foreground};
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  cursor: text;
  box-sizing: border-box;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray250};
  }

  &:focus {
    outline: none;
    background: ${theme.colors.gray250};
    box-shadow: inset 0 0 0 1.5px ${theme.colors.foreground};
  }

  &:disabled {
    color: ${theme.colors.foreground};
    cursor: default;
  }
`;

let CrumbSeparator = styled.span`
  color: ${theme.colors.gray500};
  font-size: 14px;
`;

let SwitchLabel = styled.span<{ $animate: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 200px;
  color: ${theme.colors.gray700};
  animation: ${({ $animate }) =>
    $animate
      ? css`
          ${labelSwap} 0.32s ${workspaceEase}
        `
      : 'none'};

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let SwitchChevron = styled(RiArrowDownSLine)`
  width: 15px !important;
  height: 15px !important;
  color: ${theme.colors.gray600};
`;

let ReadOnlyChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  margin: 0 4px;
  padding: 0 8px;
  border-radius: 999px;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray700};
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;

  svg {
    width: 13px;
    height: 13px;
  }
`;

let SwitcherSearch = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  margin: 8px 8px 4px;
  padding: 0 10px;
  border: 1px solid ${theme.colors.gray350};
  border-radius: 8px;
  color: ${theme.colors.gray600};

  svg {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: ${theme.colors.foreground};
    font-family: inherit;
    font-size: 13px;
  }

  &:focus-within {
    border-color: ${theme.colors.gray600};
  }
`;

let SwitcherList = styled.div`
  max-height: 360px;
  padding: 4px 6px 6px;
  overflow-y: auto;
`;

let SwitcherGroupLabel = styled.div`
  padding: 8px 8px 4px;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
`;

let SwitcherRow = styled(Link)<{ $active?: boolean; $depth: number }>`
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 8px 0 ${({ $depth }) => 8 + $depth * 18}px;
  border-radius: 6px;
  background: ${({ $active }) => ($active ? theme.colors.gray300 : 'transparent')};
  color: ${({ $active }) => ($active ? theme.colors.foreground : theme.colors.gray800)};
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 500 : 400)};
  text-decoration: none;

  &:hover {
    background: ${({ $active }) => ($active ? theme.colors.gray300 : theme.colors.gray200)};
    text-decoration: none;
  }

  svg {
    flex: 0 0 auto;
    color: ${({ $active }) => ($active ? theme.colors.foreground : theme.colors.gray600)};
  }

  span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    flex: 0 0 auto;
    color: ${theme.colors.gray600};
    font-size: 11px;
  }
`;

let SwitcherDirectory = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 8px 0 ${({ $depth }) => 8 + $depth * 18}px;
  color: ${theme.colors.gray650};
  font-size: 13px;

  svg {
    flex: 0 0 auto;
    color: ${theme.colors.gray600};
  }
`;

let SwitcherEmpty = styled.div`
  padding: 8px;
  color: ${theme.colors.gray650};
  font-size: 12.5px;
`;

let SwitcherFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let FooterButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${theme.colors.gray700};
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
    color: ${theme.colors.foreground};
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

let Spacer = styled.span`
  flex: 1;
`;

export let InlineNameField = (p: {
  name: string;
  size: WorkspaceSize;
  readOnly?: boolean;
  onNameChange?: (name: string) => Promise<void>;
}) => {
  let [draft, setDraft] = useState(p.name);
  let [saving, setSaving] = useState(false);
  let inputRef = useRef<HTMLInputElement>(null);
  let canEdit = !p.readOnly && !!p.onNameChange;

  useEffect(() => {
    if (document.activeElement != inputRef.current) setDraft(p.name);
  }, [p.name]);

  let save = async () => {
    let name = draft.trim();
    if (!name) return setDraft(p.name);
    if (name == p.name || !p.onNameChange || saving) return;

    setSaving(true);
    try {
      await p.onNameChange(name);
    } catch {
      setDraft(p.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NameInput
      ref={inputRef}
      $size={p.size}
      aria-label="Skill name"
      disabled={!canEdit || saving}
      size={Math.max(draft.length, 4)}
      title={p.name}
      value={draft}
      onBlur={() => void save()}
      onChange={event => setDraft(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key == 'Enter') event.currentTarget.blur();
        if (event.key == 'Escape') {
          setDraft(p.name);
          requestAnimationFrame(() => inputRef.current?.blur());
        }
      }}
    />
  );
};

let FileSwitcherContent = (p: {
  files: WorkspaceFileEntry[];
  agents: WorkspaceFileEntry[];
  activeHref: string | null;
  readOnly?: boolean;
  filesPinned: boolean;
  onNavigate: () => void;
  onEntryHover?: (entry: WorkspaceFileEntry) => void;
  onNewDocument?: () => void;
  onPinFiles?: () => void;
}) => {
  let [query, setQuery] = useState('');
  let normalized = query.trim().toLowerCase();

  let files = useMemo(() => {
    if (!normalized) return p.files;
    return p.files.filter(
      entry => entry.kind != 'directory' && entry.path.toLowerCase().includes(normalized)
    );
  }, [p.files, normalized]);

  let agents = useMemo(
    () =>
      normalized
        ? p.agents.filter(entry => entry.name.toLowerCase().includes(normalized))
        : p.agents,
    [p.agents, normalized]
  );

  return (
    <>
      <SwitcherSearch>
        <RiSearchLine />
        <input
          autoFocus
          placeholder="Jump to a file…"
          value={query}
          onChange={event => setQuery(event.currentTarget.value)}
        />
      </SwitcherSearch>

      <SwitcherList>
        {files.map(entry =>
          entry.href ? (
            <SwitcherRow
              key={entry.id}
              to={entry.href}
              $active={entry.href == p.activeHref}
              $depth={normalized ? 0 : entry.depth}
              onClick={p.onNavigate}
              onPointerEnter={() => p.onEntryHover?.(entry)}
            >
              <WorkspaceFileIcon kind={entry.kind} name={entry.name} />
              <span>{normalized ? entry.path : entry.name}</span>
              {entry.isMain ? <small>Main</small> : null}
            </SwitcherRow>
          ) : (
            <SwitcherDirectory key={entry.id} $depth={entry.depth}>
              <WorkspaceFileIcon kind="directory" name={entry.name} />
              {entry.name}
            </SwitcherDirectory>
          )
        )}

        {agents.length ? <SwitcherGroupLabel>AGENTS</SwitcherGroupLabel> : null}
        {agents.map(entry => (
          <SwitcherRow
            key={entry.id}
            to={entry.href ?? '#'}
            $active={entry.href == p.activeHref}
            $depth={0}
            onClick={p.onNavigate}
            onPointerEnter={() => p.onEntryHover?.(entry)}
          >
            <WorkspaceFileIcon kind="agent" name={entry.name} />
            <span>{entry.name}</span>
          </SwitcherRow>
        ))}

        {!files.length && !agents.length ? (
          <SwitcherEmpty>No matching files.</SwitcherEmpty>
        ) : null}
      </SwitcherList>

      {!p.readOnly && (p.onNewDocument || (!p.filesPinned && p.onPinFiles)) ? (
        <SwitcherFooter>
          {p.onNewDocument ? (
            <FooterButton
              type="button"
              onClick={() => {
                p.onNavigate();
                p.onNewDocument?.();
              }}
            >
              <RiAddLine />
              New document
            </FooterButton>
          ) : null}
          {!p.filesPinned && p.onPinFiles ? (
            <>
              <Spacer />
              <Tooltip content="Keep the file tree open">
                <FooterButton type="button" onClick={p.onPinFiles}>
                  <RiPushpinLine />
                  Pin
                </FooterButton>
              </Tooltip>
            </>
          ) : null}
        </SwitcherFooter>
      ) : null}
    </>
  );
};

export type ActiveWorkspaceFile = {
  key: string;
  name: string;
  kind: WorkspaceFileEntry['kind'];
};

export let WorkspaceNavLeft = (p: {
  clusterRef: RefObject<HTMLDivElement | null>;
  size: WorkspaceSize;
  offset: number;
  onSettled: () => void;
  backPath?: string | null;
  iconSlot: ReactNode;
  name: string;
  readOnly?: boolean;
  onNameChange?: (name: string) => Promise<void>;
  activeFile: ActiveWorkspaceFile;
  files: WorkspaceFileEntry[];
  agents: WorkspaceFileEntry[];
  activeHref: string | null;
  switcherOpen: boolean;
  onSwitcherOpenChange: (open: boolean) => void;
  filesPinned: boolean;
  onPinFiles?: () => void;
  onEntryHover?: (entry: WorkspaceFileEntry) => void;
  onNewDocument?: () => void;
  toolbar: { on: boolean; onToggle: () => void } | null;
  moreItems: FloatingMenuItem[];
}) => {
  useMorphWidths(p.clusterRef, p.onSettled);
  let navigate = useNavigate();

  let lastFileKey = useRef(p.activeFile.key);
  let animateLabel = lastFileKey.current != p.activeFile.key;
  useEffect(() => {
    lastFileKey.current = p.activeFile.key;
  }, [p.activeFile.key]);

  let compact = p.size == 'xs';
  let iconOnlyFile = p.size == 'xs' || p.size == 'sm';

  return (
    <Cluster ref={p.clusterRef} $side="left" $size={p.size} $offset={p.offset}>
      <FloatingBar data-key="ident">
        {p.backPath ? (
          <NavIconButton
            icon={<RiArrowLeftLine />}
            label="Back to skills"
            onClick={() => navigate(p.backPath!)}
          />
        ) : null}
        {p.backPath ? <FloatingBarSeparator /> : null}

        {p.iconSlot}

        {!compact ? (
          <InlineNameField
            name={p.name}
            size={p.size}
            readOnly={p.readOnly}
            onNameChange={p.onNameChange}
          />
        ) : null}
        {!compact && !iconOnlyFile ? <CrumbSeparator>/</CrumbSeparator> : null}

        <FloatingPopover
          open={p.switcherOpen}
          onOpenChange={p.onSwitcherOpenChange}
          width={300}
          trigger={
            <NavButton tooltip="Switch file  ⇧⌘E" iconRight={<SwitchChevron />}>
              <SwitchLabel key={p.activeFile.key} $animate={animateLabel}>
                <WorkspaceFileIcon kind={p.activeFile.kind} name={p.activeFile.name} />
                {!iconOnlyFile ? <span>{p.activeFile.name}</span> : null}
              </SwitchLabel>
            </NavButton>
          }
        >
          <FileSwitcherContent
            files={p.files}
            agents={p.agents}
            activeHref={p.activeHref}
            readOnly={p.readOnly}
            filesPinned={p.filesPinned}
            onNavigate={() => p.onSwitcherOpenChange(false)}
            onEntryHover={p.onEntryHover}
            onNewDocument={p.onNewDocument}
            onPinFiles={p.onPinFiles}
          />
        </FloatingPopover>

        {p.readOnly ? (
          <ReadOnlyChip>
            <RiEyeLine />
            View only
          </ReadOnlyChip>
        ) : null}
      </FloatingBar>

      <FloatingBar data-key="more">
        {p.toolbar && !compact ? (
          <NavIconButton
            icon={<RiFontSize2 />}
            label="Formatting"
            tooltip="Formatting  ⇧⌘F"
            active={p.toolbar.on}
            onClick={p.toolbar.onToggle}
          />
        ) : null}
        <FloatingMenu
          trigger={<NavIconButton icon={<RiMoreFill />} label="More" />}
          items={p.moreItems}
          minWidth={280}
        />
      </FloatingBar>
    </Cluster>
  );
};

export let WorkspaceNavRight = (p: {
  clusterRef: RefObject<HTMLDivElement | null>;
  size: WorkspaceSize;
  tight: boolean;
  onSettled: () => void;
  createMergeRequest?: (() => void) | null;
  comments: { open: boolean; count: number; onToggle: () => void } | null;
  onVersionHistory: (() => void) | null;
  share: ((trigger: ReactNode) => ReactNode) | null;
  onExport?: (() => void) | null;
  exportLoading?: boolean;
  forkLabel: string;
  forkItems: FloatingMenuItem[];
  skillItems: FloatingMenuItem[];
}) => {
  useMorphWidths(p.clusterRef, p.onSettled);

  let compact = p.size == 'xs';
  let collapseMergeRequest = p.tight || p.size != 'lg';

  return (
    <Cluster ref={p.clusterRef} $side="right" $size={p.size}>
      {p.createMergeRequest && !compact ? (
        <div data-key="merge-request">
          {collapseMergeRequest ? (
            <NavTextButton
              aria-label="Create merge request"
              tooltip="Create merge request"
              icon={<RiGitPullRequestLine />}
              onClick={p.createMergeRequest}
              style={{ width: 40, padding: 0, justifyContent: 'center' }}
            />
          ) : (
            <NavTextButton icon={<RiGitPullRequestLine />} onClick={p.createMergeRequest}>
              Create merge request
            </NavTextButton>
          )}
        </div>
      ) : null}

      <FloatingBar data-key="social">
        {p.comments ? (
          <NavIconButton
            icon={<RiChat3Line />}
            label="Comments"
            active={p.comments.open}
            badge={p.comments.count || undefined}
            onClick={p.comments.onToggle}
          />
        ) : null}
        {!compact ? (
          <NavIconButton
            icon={<RiHistoryLine />}
            label="Version history"
            disabled={!p.onVersionHistory}
            onClick={p.onVersionHistory ?? undefined}
          />
        ) : null}
        {p.share ? p.share(<NavShareButton type="button">Share</NavShareButton>) : null}
      </FloatingBar>

      <FloatingBar data-key="actions">
        {p.onExport && !compact ? (
          <NavIconButton
            icon={<RiDownload2Line />}
            label="Export skill (.zip)"
            disabled={p.exportLoading}
            onClick={p.onExport}
          />
        ) : null}
        {p.forkItems.length && !compact ? (
          <FloatingMenu
            trigger={<NavIconButton icon={<RiGitForkLine />} label={p.forkLabel} />}
            items={p.forkItems}
            align="end"
            minWidth={260}
          />
        ) : null}
        <FloatingMenu
          trigger={<NavIconButton icon={<RiSettings3Line />} label="Skill" />}
          items={p.skillItems}
          align="end"
          minWidth={300}
        />
      </FloatingBar>
    </Cluster>
  );
};
