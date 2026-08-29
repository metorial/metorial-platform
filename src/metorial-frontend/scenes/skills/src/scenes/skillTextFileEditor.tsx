import { MonacoCodeEditor } from '@metorial/code-editor-monaco';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useFile,
  useModifyStoreItems,
  useStoreItem,
  useStorePermissions,
  useUploadFile
} from '@metorial/state';
import { Input, Popover, Spinner, Text, theme, toast } from '@metorial/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { getSkillCodeEditorLanguage } from '../components/textFile';
import { forceFileTreeRefetch } from './skillStoreFileViewer';

let Shell = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
  flex-shrink: 0;
`;

let HeaderSide = styled.div`
  display: flex;
  flex: 1 1 0;
  align-items: center;
  min-width: 0;

  &:last-child {
    justify-content: flex-end;
  }
`;

let NameTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  height: 30px;
  max-width: 280px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.foreground};
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray300};
  }

  &:disabled {
    color: ${theme.colors.gray600};
    cursor: default;
  }
`;

let NamePopover = styled.div`
  width: 270px;
`;

let EditorWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

let Center = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 20px;
`;

let basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;
let dirname = (path: string) => {
  let parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
};
let pathWithName = (path: string, name: string) => {
  let parent = dirname(path);
  return parent ? `${parent}/${name}` : name;
};

let AUTOSAVE_DELAY_MS = 7_000;
let AUTOSAVE_MAX_DELAY_MS = 60_000;
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

let SkillTextFileEditorInner = (p: {
  instanceId: string;
  storeId: string;
  itemId: string;
  item: NonNullable<ReturnType<typeof useStoreItem>['data']>;
  readOnly: boolean;
  onItemChange: () => void;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let file = useFile(p.instanceId, p.item.file?.id);
  let uploadFile = useUploadFile();
  let modifyStoreItems = useModifyStoreItems();
  let [content, setContent] = useState<string | null>(null);
  let [savedContent, setSavedContent] = useState('');
  let [path, setPath] = useState(p.item.path);
  let [draftName, setDraftName] = useState(basename(p.item.path));
  let [loadError, setLoadError] = useState<string | null>(null);
  let [isRenaming, setIsRenaming] = useState(false);
  let [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  let renameInFlight = useRef(false);
  let savedFileIdsRef = useRef(new Set<string>());
  let contentRef = useRef<string | null>(null);
  let savedContentRef = useRef('');
  let pathRef = useRef(p.item.path);
  let saveTimerRef = useRef<number | null>(null);
  let maxSaveTimerRef = useRef<number | null>(null);
  let saveInFlightRef = useRef<Promise<boolean> | null>(null);
  let mountedRef = useRef(true);
  let pendingNavigationRef = useRef(false);
  let uploadFileRef = useRef(uploadFile);
  let itemFileRef = useRef(p.item.file);
  let onItemChangeRef = useRef(p.onItemChange);
  let flushSaveRef = useRef<() => Promise<boolean>>(async () => true);
  let navigate = useNavigate();

  uploadFileRef.current = uploadFile;
  itemFileRef.current = p.item.file;
  onItemChangeRef.current = p.onItemChange;
  contentRef.current = content;
  savedContentRef.current = savedContent;
  pathRef.current = path;

  useEffect(() => {
    p.setRestrictHeight?.(true);
    return () => p.setRestrictHeight?.(false);
  }, [p.setRestrictHeight]);

  useEffect(() => {
    setPath(p.item.path);
    pathRef.current = p.item.path;
    setDraftName(basename(p.item.path));
  }, [p.item.path]);

  useEffect(() => {
    let downloadUrl = file.data?.downloadUrl;
    if (!downloadUrl) return;

    if (file.data?.id && savedFileIdsRef.current.has(file.data.id)) {
      savedFileIdsRef.current.delete(file.data.id);
      return;
    }

    let cancelled = false;
    setContent(null);
    setLoadError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return response.text();
      })
      .then(value => {
        if (cancelled) return;
        setContent(value);
        contentRef.current = value;
        setSavedContent(value);
        savedContentRef.current = value;
        setSaveStatus('saved');
      })
      .catch(error => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load file');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.data?.downloadUrl]);

  let fileName = basename(path);
  let language = useMemo(() => getSkillCodeEditorLanguage(fileName), [fileName]);

  let flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    if (saveInFlightRef.current) {
      let previousSucceeded = await saveInFlightRef.current;
      if (!previousSucceeded) return false;
    }

    let nextContent = contentRef.current;
    if (
      p.readOnly ||
      nextContent == null ||
      nextContent == savedContentRef.current ||
      !itemFileRef.current
    ) {
      if (mountedRef.current) setSaveStatus('saved');
      return true;
    }

    let savePath = pathRef.current;
    let saveFileName = basename(savePath);
    if (mountedRef.current) setSaveStatus('saving');

    let savePromise = (async () => {
      let itemFile = itemFileRef.current!;
      let [uploaded, uploadError] = await uploadFileRef.current.mutate({
        instanceId: p.instanceId,
        file: new File([nextContent], saveFileName, {
          type: itemFile.fileType || 'text/plain'
        }),
        title: saveFileName,
        purpose: itemFile.purpose || 'generic',
        store: {
          id: p.storeId,
          path: savePath
        },
        storeReplace: true
      });
      if (uploadError || !uploaded) {
        if (!uploaded && !uploadError) {
          toast.error('File upload completed without a result');
        }
        if (mountedRef.current) setSaveStatus('error');
        return false;
      }

      savedFileIdsRef.current.add(uploaded.id);
      savedContentRef.current = nextContent;
      if (mountedRef.current) {
        setSavedContent(nextContent);
        setSaveStatus(contentRef.current == nextContent ? 'saved' : 'pending');
      }
      onItemChangeRef.current();
      forceFileTreeRefetch();
      return true;
    })();

    saveInFlightRef.current = savePromise;
    try {
      return await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
    }
  }, [p.instanceId, p.readOnly, p.storeId]);
  flushSaveRef.current = flushSave;

  let enqueueSave = useCallback(() => {
    if (p.readOnly || contentRef.current == savedContentRef.current) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('pending');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_DELAY_MS);
    if (!maxSaveTimerRef.current) {
      maxSaveTimerRef.current = window.setTimeout(() => {
        void flushSave();
      }, AUTOSAVE_MAX_DELAY_MS);
    }
  }, [flushSave, p.readOnly]);

  useEffect(() => {
    if (content == null || content == savedContentRef.current) return;
    enqueueSave();
  }, [content, enqueueSave]);

  let rename = async () => {
    let name = draftName.trim();
    if (
      p.readOnly ||
      renameInFlight.current ||
      !name ||
      name.includes('/') ||
      name == fileName
    ) {
      if (!name || name.includes('/')) setDraftName(fileName);
      return;
    }

    let nextPath = pathWithName(path, name);
    renameInFlight.current = true;
    setIsRenaming(true);
    try {
      if (!(await flushSave())) {
        setDraftName(fileName);
        return;
      }
      let [, error] = await modifyStoreItems.mutate({
        instanceId: p.instanceId,
        storeId: p.storeId,
        operations: [{ type: 'modify', itemId: p.itemId, path: nextPath }]
      });
      if (error) throw error;
      setPath(nextPath);
      pathRef.current = nextPath;
      p.onItemChange();
      forceFileTreeRefetch();
    } catch (error) {
      setDraftName(fileName);
      toast.error(error instanceof Error ? error.message : 'Failed to rename file');
    } finally {
      renameInFlight.current = false;
      setIsRenaming(false);
    }
  };

  let hasUnsavedChanges =
    !p.readOnly &&
    (content != savedContent || saveStatus == 'saving' || saveStatus == 'error');

  useBlocker(tx => {
    if (!hasUnsavedChanges || pendingNavigationRef.current) return false;
    pendingNavigationRef.current = true;

    void flushSave().then(saved => {
      if (!saved) {
        pendingNavigationRef.current = false;
        toast.error('Could not save file.');
        return;
      }

      navigate(
        {
          pathname: tx.nextLocation.pathname,
          search: tx.nextLocation.search,
          hash: tx.nextLocation.hash
        },
        { state: tx.nextLocation.state }
      );
    });

    return true;
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    let handleBeforeUnload = (event: BeforeUnloadEvent) => {
      void flushSave();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSave, hasUnsavedChanges]);

  useEffect(() => {
    let handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() != 's') return;

      event.preventDefault();
      event.stopPropagation();
      toast('File saved automatically');
    };

    window.addEventListener('keydown', handleSaveShortcut, true);
    return () => window.removeEventListener('keydown', handleSaveShortcut, true);
  }, []);

  useEffect(() => {
    let handleVisibilityChange = () => {
      if (
        document.visibilityState == 'hidden' &&
        contentRef.current != savedContentRef.current
      ) {
        void flushSave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [flushSave]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    let handleReloadShortcut = (event: KeyboardEvent) => {
      let isReloadShortcut =
        event.key == 'F5' ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() == 'r');
      if (!isReloadShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      void flushSave().then(saved => {
        if (saved) window.location.reload();
      });
    };
    window.addEventListener('keydown', handleReloadShortcut, true);
    return () => window.removeEventListener('keydown', handleReloadShortcut, true);
  }, [flushSave, hasUnsavedChanges]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (maxSaveTimerRef.current) window.clearTimeout(maxSaveTimerRef.current);
      void flushSaveRef.current();
    };
  }, []);

  if (file.error || loadError) {
    return (
      <Center>
        <Text color="red600" size="2">
          {loadError ?? file.error?.message ?? 'Failed to load file'}
        </Text>
      </Center>
    );
  }

  if (content == null) {
    return (
      <Center>
        <Spinner size={20} />
      </Center>
    );
  }

  return (
    <Shell>
      <Header>
        <HeaderSide>
          <Popover
            align="start"
            operationKey={path}
            side="bottom"
            sideOffset={7}
            trigger={
              <NameTrigger disabled={p.readOnly} title={fileName} type="button">
                {fileName}
              </NameTrigger>
            }
          >
            <Popover.Content>
              <NamePopover>
                <Input
                  autoFocus
                  disabled={isRenaming}
                  label="Name"
                  value={draftName}
                  onBlur={() => void rename()}
                  onInput={setDraftName}
                  onKeyDown={event => {
                    if (event.key == 'Enter') {
                      event.preventDefault();
                      void rename();
                    }
                  }}
                />
              </NamePopover>
            </Popover.Content>
          </Popover>
        </HeaderSide>
        <HeaderSide>
          <Text color="gray600" size="1">
            File saved automatically
          </Text>
        </HeaderSide>
      </Header>
      <EditorWrap>
        <MonacoCodeEditor
          ariaLabel={`${fileName} editor`}
          fileName={fileName}
          language={language}
          onChange={setContent}
          readOnly={p.readOnly}
          value={content}
        />
      </EditorWrap>
      <uploadFile.RenderError />
      <modifyStoreItems.RenderError />
    </Shell>
  );
};

export let SkillTextFileEditorScene = (p: {
  instanceId: string | null | undefined;
  storeId: string | null | undefined;
  itemId: string | null | undefined;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let item = useStoreItem(p.instanceId, p.storeId, p.itemId);
  let permissions = useStorePermissions(p.instanceId, p.storeId);

  return renderWithLoader(
    { item, permissions },
    { spaceTop: 20 }
  )(({ item, permissions }) => (
    <SkillTextFileEditorInner
      instanceId={p.instanceId!}
      item={item.data}
      itemId={p.itemId!}
      onItemChange={() => item.refetch()}
      readOnly={
        !permissions.data.hasFullAccess &&
        !permissions.data.permissions.includes('content_write')
      }
      setRestrictHeight={p.setRestrictHeight}
      storeId={p.storeId!}
    />
  ));
};
