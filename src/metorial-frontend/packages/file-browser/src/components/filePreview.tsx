import { CodeEditor } from '@metorial/code-editor';
import { formatFileSize } from '@metorial/file-upload';
import { Button, RenderDate, confirm, Progress, theme, toast, Tooltip } from '@metorial/ui';
import { RiDownload2Line, RiFileForbidLine, RiImageLine } from '@remixicon/react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { describeFileSystemError } from '../lib/errors';
import { formatMode } from '../lib/format';
import { detectLanguage } from '../lib/language';
import { IMAGE_PREVIEW_LIMIT, type UnsupportedReason } from '../lib/preview';
import { isDownloadable } from '../lib/actions';
import { normalizeLineEndings } from '../lib/text';
import { saveText } from '../state/fileContent';
import { useElementHeight } from '../state/hooks';
import { useFilePreview } from '../state/useFilePreview';
import type { FileEntry, FileSystemAdapter } from '../types';
import { askSaveConflict } from './dialogs';
import { EntryIcon } from './entryIcon';
import { Notice, NoticeText } from './notice';
import { ErrorState, StateCard } from './stateViews';

let Root = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  min-width: 0;
  padding: 10px 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let HeaderMain = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

let HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

let FileName = styled.span`
  overflow: hidden;
  color: ${theme.colors.foreground};
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let FileMeta = styled.span`
  overflow: hidden;
  color: ${theme.colors.gray600};
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
`;

let Body = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

let EditorHost = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

let ImageStage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background: ${theme.colors.gray100};

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border: 1px solid ${theme.colors.gray300};
    border-radius: 6px;
    background: ${theme.colors.background};
  }
`;

let ProgressWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 260px;
`;

let ProgressCenter = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
`;

let unsupportedCopy: Record<UnsupportedReason, { title: string; description: string }> = {
  binary: {
    title: 'No Preview Available',
    description: 'This file doesn’t look like text. Download it to open it elsewhere.'
  },
  'image-too-large': {
    title: 'Image Too Large to Preview',
    description: `Images up to ${formatFileSize(IMAGE_PREVIEW_LIMIT)} can be previewed. Download it to see the full image.`
  },
  'not-file': {
    title: 'No Preview Available',
    description: 'This item isn’t a regular file, so it can’t be previewed.'
  }
};

export interface FilePreviewProps {
  adapter: FileSystemAdapter;
  entry: FileEntry;
  readOnly?: boolean;
  reloadKey: number;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (entry: FileEntry) => void;
  onDownload: (entry: FileEntry) => void;
}

export let FilePreview = (p: FilePreviewProps) => {
  let [nonce, setNonce] = useState(0);
  let [editing, setEditing] = useState(false);
  let [draft, setDraft] = useState('');
  let [saving, setSaving] = useState(false);
  let [saveError, setSaveError] = useState<string | null>(null);
  let [savedEntry, setSavedEntry] = useState<FileEntry | null>(null);
  let [editorRef, editorHeight] = useElementHeight<HTMLDivElement>();

  let onDirtyChangeRef = useRef(p.onDirtyChange);
  onDirtyChangeRef.current = p.onDirtyChange;

  let handle = useFilePreview({
    adapter: p.adapter,
    entry: p.entry,
    reloadToken: `${p.reloadKey}:${nonce}`
  });

  let entry = savedEntry ?? p.entry;
  let ready = handle.state.status == 'ready' ? handle.state.preview : null;
  let textPreview = ready?.kind == 'text' ? ready : null;
  let language = detectLanguage(entry.path);

  let dirty =
    editing &&
    !!textPreview &&
    normalizeLineEndings(draft) != normalizeLineEndings(textPreview.text);

  let canEdit = !p.readOnly && !!textPreview;
  let canEditNow = canEdit && !!textPreview?.complete;

  useEffect(() => {
    setSavedEntry(null);
  }, [p.entry]);

  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setSavedEntry(null);
  }, [p.entry.path, p.reloadKey, nonce]);

  useEffect(() => {
    onDirtyChangeRef.current(dirty);
  }, [dirty]);

  useEffect(() => () => onDirtyChangeRef.current(false), []);

  let reload = () => setNonce(value => value + 1);

  let startEditing = () => {
    if (!textPreview) return;

    setDraft(textPreview.text);
    setSaveError(null);
    setEditing(true);
  };

  let stopEditing = () => {
    setEditing(false);
    setSaveError(null);
  };

  let cancelEditing = () => {
    if (!dirty) return stopEditing();

    confirm({
      title: 'Discard Changes',
      description: `Your edits to ${entry.name} haven’t been saved and will be lost.`,
      confirmText: 'Discard',
      onConfirm: stopEditing
    });
  };

  let save = async (force = false): Promise<void> => {
    if (!textPreview) return;

    setSaving(true);
    setSaveError(null);

    try {
      let result = await saveText(p.adapter, entry, textPreview, draft, { force });

      if (result.status == 'conflict') {
        let choice = await askSaveConflict(entry.name);

        if (choice == 'overwrite') return await save(true);
        if (choice == 'reload') reload();

        return;
      }

      handle.applySaved(draft, result.entry);
      setSavedEntry(result.entry);
      stopEditing();

      toast.success(`Saved ${entry.name}`);
      p.onSaved(result.entry);
    } catch (error) {
      setSaveError(describeFileSystemError(error, { path: entry.path }).message);
    } finally {
      setSaving(false);
    }
  };

  let onEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!editing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() != 's') return;

    e.preventDefault();
    if (dirty && !saving) void save();
  };

  let modeText = formatMode(entry.mode, entry.type);

  let renderBody = () => {
    let state = handle.state;

    if (state.status == 'loading') {
      let percent = state.total > 0 ? Math.round((state.loaded / state.total) * 100) : null;
      let hasProgress = state.loaded > 0 && percent != null;

      return (
        <ProgressCenter role="status">
          <ProgressWrap>
            <Progress
              size="1"
              value={hasProgress ? percent : null}
              label="Loading file"
              showValue={hasProgress}
            />
          </ProgressWrap>
        </ProgressCenter>
      );
    }

    if (state.status == 'error') {
      return <ErrorState error={state.error} path={entry.path} onRetry={reload} />;
    }

    let preview = state.preview;

    if (preview.kind == 'unsupported') {
      let copy = unsupportedCopy[preview.reason];

      return (
        <StateCard
          icon={
            preview.reason == 'image-too-large' ? (
              <RiImageLine size={20} />
            ) : (
              <RiFileForbidLine size={20} />
            )
          }
          title={copy.title}
          description={copy.description}
          actions={
            isDownloadable(entry) ? (
              <Button
                type="button"
                size="2"
                variant="outline"
                iconLeft={<RiDownload2Line />}
                onClick={() => p.onDownload(entry)}
              >
                Download
              </Button>
            ) : undefined
          }
        />
      );
    }

    if (preview.kind == 'image') {
      return (
        <ImageStage>
          <img src={state.imageUrl} alt={entry.name} />
        </ImageStage>
      );
    }

    return (
      <>
        {!preview.complete ? (
          <Notice $tone="neutral">
            <NoticeText>
              {handle.loadMoreError
                ? describeFileSystemError(handle.loadMoreError).message
                : `Showing the first ${formatFileSize(preview.loadedBytes)} of ${formatFileSize(preview.size)}.`}
            </NoticeText>
            <Button
              type="button"
              size="1"
              variant="outline"
              loading={handle.loadingMore}
              onClick={handle.loadMore}
            >
              Load More
            </Button>
          </Notice>
        ) : null}

        {saveError ? (
          <Notice $tone="error" role="alert">
            <NoticeText>{saveError}</NoticeText>
          </Notice>
        ) : null}

        <EditorHost ref={editorRef} onKeyDown={onEditorKeyDown}>
          <CodeEditor
            border={false}
            height={`${editorHeight || 360}px`}
            lang={language.editor}
            readOnly={!editing}
            value={editing ? draft : preview.text}
            onChange={editing ? setDraft : undefined}
          />
        </EditorHost>
      </>
    );
  };

  return (
    <Root>
      <Header>
        <HeaderMain>
          <EntryIcon entry={entry} size={18} />

          <HeaderCopy>
            <FileName title={entry.name}>{entry.name}</FileName>
            <FileMeta>
              {formatFileSize(entry.size)}
              <span>
                {' · '}Modified{' '}
                {entry.modifiedAt ? <RenderDate date={entry.modifiedAt} /> : '—'}
              </span>
              {modeText ? ` · ${modeText}` : null}
              {entry.type == 'symlink' && entry.target ? ` · → ${entry.target}` : null}
            </FileMeta>
          </HeaderCopy>
        </HeaderMain>

        <HeaderActions>
          {editing ? (
            <>
              <Button
                type="button"
                size="2"
                variant="outline"
                disabled={saving}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="2"
                loading={saving}
                disabled={!dirty}
                onClick={() => void save()}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              {isDownloadable(entry) ? (
                <Button
                  type="button"
                  size="2"
                  variant="outline"
                  iconLeft={<RiDownload2Line />}
                  onClick={() => p.onDownload(entry)}
                >
                  Download
                </Button>
              ) : null}

              {canEdit ? (
                <Tooltip content="Load the whole file to edit it." enabled={!canEditNow}>
                  <span>
                    <Button
                      type="button"
                      size="2"
                      disabled={!canEditNow}
                      onClick={startEditing}
                    >
                      Edit
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
            </>
          )}
        </HeaderActions>
      </Header>

      <Body>{renderBody()}</Body>
    </Root>
  );
};
