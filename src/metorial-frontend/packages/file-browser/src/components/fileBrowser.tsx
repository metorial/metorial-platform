import { UploadTray } from '@metorial/file-upload';
import { Button, confirm, theme } from '@metorial/ui';
import { RiEyeOffLine, RiFolderForbidLine } from '@remixicon/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode
} from 'react';
import styled, { css } from 'styled-components';
import { getEntryActions, isDownloadable } from '../lib/actions';
import { FileSystemError } from '../lib/errors';
import {
  dirname,
  getAncestorPaths,
  hasHiddenSegment,
  isSameOrDescendant,
  normalizePath,
  replacePathPrefix,
  ROOT_PATH
} from '../lib/path';
import {
  DEFAULT_FILE_SORT,
  filterHiddenEntries,
  isHiddenEntry,
  sortEntries,
  toggleSort
} from '../lib/sort';
import { describeUploadDirectory } from '../lib/upload';
import { createDirectoryStore } from '../state/directoryStore';
import { useResolvedPath } from '../state/hooks';
import { useFileOperations } from '../state/useFileOperations';
import type { FileBrowserStatus, FileEntry, FileSystemAdapter } from '../types';
import { FilePreview } from './filePreview';
import { FolderTree } from './folderTree';
import { Listing, type ListingAction } from './listing';
import { Notice, NoticeText } from './notice';
import {
  EmptyFolderState,
  ErrorState,
  ListingSkeleton,
  LoadingState,
  StateCard
} from './stateViews';
import { FileBrowserToolbar } from './toolbar';

let FULLSCREEN_Z_INDEX = 900;
let TREE_HIDE_BELOW_WIDTH = 640;
let TRAY_WIDTH = 340;

let Root = styled.section<{ $fullscreen: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 360px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.background};
  container-type: inline-size;
  overflow: hidden;

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

let Main = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

let TreeSlot = styled.div`
  display: flex;
  flex: none;
  min-height: 0;

  @container (max-width: ${TREE_HIDE_BELOW_WIDTH}px) {
    display: none;
  }
`;

let Pane = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

let TrayDock = styled.div`
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 3;
  width: min(${TRAY_WIDTH}px, calc(100% - 24px));
`;

export interface FileBrowserProps {
  adapter: FileSystemAdapter;
  path?: string;
  initialPath?: string;
  onPathChange?: (path: string) => void;
  rootPath?: string;
  status?: FileBrowserStatus;
  statusView?: ReactNode;
  onReconnect?: () => void;
  readOnly?: boolean;
  showTree?: boolean;
  defaultTreeOpen?: boolean;
  showPermissions?: boolean;
  maxUploadSize?: number;
  uploadConcurrency?: number;
  renderBadge?: (entry: FileEntry) => ReactNode;
  toolbarExtra?: ReactNode;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export let FileBrowser = (props: FileBrowserProps) => {
  let { adapter } = props;
  let status = props.status ?? 'ready';
  let ready = status == 'ready';
  let readOnly = !!props.readOnly;
  let treeAvailable = props.showTree !== false;
  let rootPath = useMemo(() => normalizePath(props.rootPath ?? ROOT_PATH), [props.rootPath]);

  let clamp = (candidate: string | null | undefined) => {
    let normalized = normalizePath(candidate);
    return isSameOrDescendant(normalized, rootPath) ? normalized : rootPath;
  };

  let controlled = props.path !== undefined;
  let [localPath, setLocalPath] = useState(() => clamp(props.initialPath ?? rootPath));
  let path = clamp(controlled ? props.path : localPath);

  let [treeOpen, setTreeOpen] = useState(props.defaultTreeOpen !== false);
  let [showHidden, setShowHidden] = useState(() => hasHiddenSegment(path));
  let [sort, setSort] = useState(DEFAULT_FILE_SORT);
  let [selectedPath, setSelectedPath] = useState<string | null>(null);
  let [reloadKey, setReloadKey] = useState(0);
  let [dirty, setDirty] = useState(false);

  let [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(getAncestorPaths(dirname(path)).filter(a => isSameOrDescendant(a, rootPath)))
  );

  let store = useMemo(() => createDirectoryStore(adapter), [adapter]);
  let snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  let dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  let [isFullscreen, setIsFullscreen] = useState(false);
  let fileInput = useRef<HTMLInputElement | null>(null);
  let wasReady = useRef(ready);

  let resolved = useResolvedPath({ adapter, snapshot, path, enabled: ready, reloadKey });
  let kind = resolved.status == 'ready' ? resolved.result.kind : null;
  let directoryPath = kind == 'directory' ? path : dirname(path);
  let directoryState = snapshot[directoryPath];
  let canGoUp = path != rootPath;
  let writeDisabled = !ready || readOnly || resolved.status != 'ready';

  let goTo = (next: string) => {
    let target = clamp(next);

    if (!controlled) setLocalPath(target);
    props.onPathChange?.(target);
  };

  let guardDirty = (proceed: () => void) => {
    if (!dirtyRef.current) return proceed();

    confirm({
      title: 'Discard Changes',
      description: 'You have unsaved changes to this file. They will be lost.',
      confirmText: 'Discard',
      onConfirm: proceed
    });
  };

  let navigate = (next: string) => {
    let target = clamp(next);
    if (target != path) guardDirty(() => goTo(target));
  };

  let up = () => navigate(dirname(path));

  let refresh = () =>
    guardDirty(() => {
      setReloadKey(key => key + 1);
      void store.load(directoryPath, { force: true });
    });

  let handleMoved = (from: string, to: string) => {
    store.forgetUnder(from);

    setExpanded(current => {
      let next = new Set<string>();

      for (let candidate of current) {
        next.add(
          isSameOrDescendant(candidate, from)
            ? replacePathPrefix(candidate, from, to)
            : candidate
        );
      }

      return next;
    });

    setSelectedPath(current =>
      current && isSameOrDescendant(current, from)
        ? replacePathPrefix(current, from, to)
        : current
    );

    if (isSameOrDescendant(path, from)) goTo(replacePathPrefix(path, from, to));
  };

  let handleDeleted = (removed: string) => {
    store.forgetUnder(removed);

    setExpanded(
      current => new Set(Array.from(current).filter(p => !isSameOrDescendant(p, removed)))
    );
    setSelectedPath(current =>
      current && isSameOrDescendant(current, removed) ? null : current
    );

    if (isSameOrDescendant(path, removed)) goTo(dirname(removed));
  };

  let operations = useFileOperations({
    adapter,
    store,
    readOnly,
    directoryPath,
    maxUploadSize: props.maxUploadSize,
    uploadConcurrency: props.uploadConcurrency,
    onOpenPath: goTo,
    onMoved: handleMoved,
    onDeleted: handleDeleted
  });

  useEffect(() => () => store.reset(), [store]);

  useEffect(() => {
    if (ready && !wasReady.current) {
      store.reset();
      setReloadKey(key => key + 1);
    }

    wasReady.current = ready;
  }, [ready, store]);

  useEffect(() => {
    if (hasHiddenSegment(path)) setShowHidden(true);
  }, [path]);

  useEffect(() => {
    if (!ready) return;

    let directory = kind == 'directory' ? path : dirname(path);

    setExpanded(current => {
      let next = new Set(current);

      for (let ancestor of getAncestorPaths(directory)) {
        if (isSameOrDescendant(ancestor, rootPath)) next.add(ancestor);
      }

      return next.size == current.size ? current : next;
    });
  }, [ready, kind, path, rootPath]);

  useEffect(() => {
    if (!ready) return;

    for (let directory of expanded) {
      if (!snapshot[directory]) void store.load(directory);
    }
  }, [ready, expanded, snapshot, store]);

  useEffect(() => {
    if (ready && kind == 'directory') void store.load(path);
  }, [ready, kind, path, store, !!directoryState]);

  useEffect(() => setSelectedPath(null), [directoryPath, adapter]);

  useEffect(() => {
    if (!dirty) return;

    let handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  let entries = useMemo(
    () => sortEntries(filterHiddenEntries(directoryState?.entries ?? [], showHidden), sort),
    [directoryState?.entries, showHidden, sort]
  );

  let selectedEntry = useMemo(
    () =>
      selectedPath
        ? entries.find(entry => normalizePath(entry.path) == selectedPath)
        : undefined,
    [entries, selectedPath]
  );

  let openEntry =
    kind == 'file' && resolved.status == 'ready' ? resolved.result.entry : undefined;
  let downloadTarget = openEntry ?? selectedEntry;

  let toggleExpanded = useCallback((target: string) => {
    setExpanded(current => {
      let next = new Set(current);

      if (next.has(target)) next.delete(target);
      else next.add(target);

      return next;
    });
  }, []);

  let runAction = (action: ListingAction, entry: FileEntry) => {
    if (action == 'open') navigate(entry.path);
    else if (action == 'download') void operations.downloadEntry(entry);
    else if (action == 'rename') operations.renameEntry(entry);
    else if (action == 'move') operations.moveEntry(entry);
    else operations.deleteEntry(entry);
  };

  let openFilePicker = () => fileInput.current?.click();

  let goUpAction = canGoUp ? (
    <Button type="button" size="2" variant="outline" onClick={up}>
      Go Up
    </Button>
  ) : undefined;

  let renderListing = () => {
    if (
      !directoryState ||
      (directoryState.status == 'loading' && !directoryState.entries.length)
    ) {
      return <ListingSkeleton />;
    }

    if (directoryState.status == 'error') {
      return (
        <ErrorState
          error={directoryState.error}
          path={directoryPath}
          extraActions={goUpAction}
          onRetry={() => void store.load(directoryPath, { force: true })}
        />
      );
    }

    let hiddenCount = directoryState.entries.filter(isHiddenEntry).length;
    let onlyHidden = !entries.length && hiddenCount > 0;

    return (
      <Listing
        entries={entries}
        sort={sort}
        selectedPath={selectedPath}
        showPermissions={!!props.showPermissions}
        canUpload={!writeDisabled}
        currentPath={directoryPath}
        emptyState={
          onlyHidden ? (
            <StateCard
              icon={<RiEyeOffLine size={20} />}
              title="Only hidden items here"
              description={`This folder contains ${hiddenCount} hidden ${hiddenCount == 1 ? 'item' : 'items'}.`}
              actions={
                <Button
                  type="button"
                  size="2"
                  variant="outline"
                  onClick={() => setShowHidden(true)}
                >
                  Show Hidden Files
                </Button>
              }
            />
          ) : (
            <EmptyFolderState canUpload={!writeDisabled} onUpload={openFilePicker} />
          )
        }
        notice={
          directoryState.truncated ? (
            <Notice $tone="warning">
              <NoticeText>
                This folder has more items than can be listed. Showing the first{' '}
                {directoryState.entries.length}.
              </NoticeText>
            </Notice>
          ) : undefined
        }
        getActions={entry => getEntryActions(entry, { readOnly })}
        renderBadge={props.renderBadge}
        onSortChange={key => setSort(current => toggleSort(current, key))}
        onSelect={setSelectedPath}
        onAction={runAction}
        onNavigateUp={up}
        onFilesDropped={(files, directory, skippedFolders) => {
          if (skippedFolders) {
            operations.notifySkippedFolders(skippedFolders, files.length);
          }

          void operations.startUploads(files, directory);
        }}
      />
    );
  };

  let renderStatus = () => {
    if (props.statusView) return props.statusView;
    if (status == 'connecting') return <LoadingState label="Connecting…" />;

    if (status == 'disconnected') {
      return (
        <ErrorState error={new FileSystemError('disconnected')} onRetry={props.onReconnect} />
      );
    }

    return (
      <StateCard
        icon={<RiFolderForbidLine size={20} />}
        title="Files Unavailable"
        description="The file system isn’t available right now."
      />
    );
  };

  let renderPane = () => {
    if (!ready) return renderStatus();
    if (resolved.status == 'loading') return <ListingSkeleton />;

    if (resolved.status == 'error') {
      return (
        <ErrorState
          error={resolved.error}
          path={path}
          extraActions={goUpAction}
          onRetry={refresh}
        />
      );
    }

    if (openEntry) {
      return (
        <FilePreview
          adapter={adapter}
          entry={openEntry}
          readOnly={readOnly}
          reloadKey={reloadKey}
          onDirtyChange={setDirty}
          onSaved={saved => void store.load(dirname(saved.path), { force: true })}
          onDownload={entry => void operations.downloadEntry(entry)}
        />
      );
    }

    return renderListing();
  };

  let uploadDirectory = describeUploadDirectory(operations.uploads.items);

  return (
    <Root
      $fullscreen={isFullscreen}
      aria-label="File browser"
      className={props.className}
      style={{ height: props.height ?? '100%', ...props.style }}
    >
      <FileBrowserToolbar
        isFullscreen={isFullscreen}
        onFullscreenChange={setIsFullscreen}
        path={path}
        rootPath={rootPath}
        disabled={!ready}
        readOnly={readOnly}
        writeDisabled={writeDisabled}
        canGoUp={canGoUp}
        refreshing={!!directoryState?.refreshing || (ready && resolved.status == 'loading')}
        showHidden={showHidden}
        treeAvailable={treeAvailable}
        treeOpen={treeOpen}
        canDownload={!!downloadTarget && isDownloadable(downloadTarget)}
        extra={props.toolbarExtra}
        onNavigate={navigate}
        onUp={up}
        onRefresh={refresh}
        onUpload={openFilePicker}
        onDownload={() => downloadTarget && void operations.downloadEntry(downloadTarget)}
        onNewFile={operations.createFile}
        onNewFolder={operations.createFolder}
        onToggleHidden={() => setShowHidden(current => !current)}
        onToggleTree={() => setTreeOpen(current => !current)}
      />

      <Main>
        {treeAvailable && treeOpen && ready ? (
          <TreeSlot>
            <FolderTree
              rootPath={rootPath}
              currentPath={path}
              snapshot={snapshot}
              expanded={expanded}
              showHidden={showHidden}
              renderBadge={props.renderBadge}
              onToggle={toggleExpanded}
              onOpen={navigate}
              onRetry={directory => void store.load(directory, { force: true })}
            />
          </TreeSlot>
        ) : null}

        <Pane>{renderPane()}</Pane>
      </Main>

      <TrayDock>
        <UploadTray
          queue={operations.uploads}
          description={uploadDirectory ? `to ${uploadDirectory}` : undefined}
          getItemDescription={item => (uploadDirectory ? undefined : item.meta?.directory)}
        />
      </TrayDock>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={e => {
          let files = Array.from(e.target.files ?? []);

          e.target.value = '';
          void operations.startUploads(files, directoryPath);
        }}
      />
    </Root>
  );
};
