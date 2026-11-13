import { useFile, useModifyStoreItems, useStoreItem, useUploadFile } from '@metorial/state';
import { toast } from '@metorial/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { forceFileTreeRefetch } from '../scenes/skillStoreFileViewer';

export type SkillTextFileSaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export type SkillTextFileItem = NonNullable<ReturnType<typeof useStoreItem>['data']>;

let AUTOSAVE_DELAY_MS = 7_000;
let AUTOSAVE_MAX_DELAY_MS = 60_000;

export let skillFileBasename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

let dirname = (path: string) => {
  let parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
};

let pathWithName = (path: string, name: string) => {
  let parent = dirname(path);
  return parent ? `${parent}/${name}` : name;
};

export let useSkillTextFile = (p: {
  instanceId: string;
  storeId: string;
  itemId: string;
  item: SkillTextFileItem;
  readOnly: boolean;
  onItemChange: () => void;
}) => {
  let file = useFile(p.instanceId, p.item.file?.id);
  let uploadFile = useUploadFile();
  let modifyStoreItems = useModifyStoreItems();
  let [content, setContent] = useState<string | null>(null);
  let [savedContent, setSavedContent] = useState('');
  let [path, setPath] = useState(p.item.path);
  let [loadError, setLoadError] = useState<string | null>(null);
  let [isRenaming, setIsRenaming] = useState(false);
  let [saveStatus, setSaveStatus] = useState<SkillTextFileSaveStatus>('saved');

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
    setPath(p.item.path);
    pathRef.current = p.item.path;
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

  let fileName = skillFileBasename(path);

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
    let saveFileName = skillFileBasename(savePath);
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

  let rename = async (draftName: string) => {
    let name = draftName.trim();
    if (
      p.readOnly ||
      renameInFlight.current ||
      !name ||
      name.includes('/') ||
      name == fileName
    ) {
      return name == fileName;
    }

    let nextPath = pathWithName(path, name);
    renameInFlight.current = true;
    setIsRenaming(true);
    try {
      if (!(await flushSave())) return false;
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
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename file');
      return false;
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

  return {
    file,
    content,
    setContent,
    saveStatus,
    loadError:
      loadError ?? (file.error ? (file.error.message ?? 'Failed to load file') : null),
    path,
    fileName,
    rename,
    isRenaming,
    flushSave,
    uploadFile,
    modifyStoreItems
  };
};
