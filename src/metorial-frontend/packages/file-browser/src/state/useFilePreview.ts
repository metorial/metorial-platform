import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileEntry, FileSystemAdapter } from '../types';
import { loadMoreText, loadPreview, type LoadedPreview } from './fileContent';

let PROGRESS_THROTTLE_MS = 80;

export type PreviewState =
  | { status: 'loading'; loaded: number; total: number }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; preview: LoadedPreview; imageUrl?: string };

export interface FilePreviewHandle {
  state: PreviewState;
  loadingMore: boolean;
  loadMoreError: unknown;
  loadMore(): void;
  applySaved(text: string, entry: FileEntry): void;
}

export let useFilePreview = (opts: {
  adapter: FileSystemAdapter;
  entry: FileEntry;
  reloadToken: string;
}): FilePreviewHandle => {
  let { adapter, reloadToken } = opts;
  let path = opts.entry.path;

  let entryRef = useRef(opts.entry);
  entryRef.current = opts.entry;

  let [state, setState] = useState<PreviewState>({
    status: 'loading',
    loaded: 0,
    total: opts.entry.size
  });

  let [more, setMore] = useState<{ loading: boolean; error?: unknown }>({ loading: false });

  let stateRef = useRef(state);
  stateRef.current = state;

  let moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    let controller = new AbortController();
    let imageUrl: string | undefined;
    let lastEmit = 0;

    setState({ status: 'loading', loaded: 0, total: entryRef.current.size });
    setMore({ loading: false });

    loadPreview(adapter, entryRef.current, {
      signal: controller.signal,
      onProgress: (loaded, total) => {
        let now = Date.now();
        if (controller.signal.aborted) return;
        if (now - lastEmit < PROGRESS_THROTTLE_MS && loaded < total) return;

        lastEmit = now;
        setState({ status: 'loading', loaded, total });
      }
    }).then(
      preview => {
        if (controller.signal.aborted) return;

        if (preview.kind == 'image') imageUrl = URL.createObjectURL(preview.blob);
        setState({ status: 'ready', preview, imageUrl });
      },
      error => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      }
    );

    return () => {
      controller.abort();
      moreController.current?.abort();
      moreController.current = null;

      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [adapter, path, reloadToken]);

  let loadMore = useCallback(() => {
    let current = stateRef.current;

    if (moreController.current) return;
    if (current.status != 'ready' || current.preview.kind != 'text') return;
    if (current.preview.complete) return;

    let controller = new AbortController();
    moreController.current = controller;
    setMore({ loading: true });

    loadMoreText(adapter, entryRef.current.path, current.preview, {
      signal: controller.signal
    }).then(
      next => {
        if (controller.signal.aborted) return;
        moreController.current = null;

        setState(latest =>
          latest.status == 'ready' && latest.preview.kind == 'text'
            ? { ...latest, preview: next }
            : latest
        );
        setMore({ loading: false });
      },
      error => {
        if (controller.signal.aborted) return;
        moreController.current = null;

        setMore({ loading: false, error });
      }
    );
  }, [adapter]);

  let applySaved = useCallback((text: string, entry: FileEntry) => {
    setState(latest =>
      latest.status == 'ready' && latest.preview.kind == 'text'
        ? {
            ...latest,
            preview: {
              ...latest.preview,
              text,
              loadedBytes: entry.size,
              size: entry.size,
              complete: true,
              baseline: { size: entry.size, modifiedAt: entry.modifiedAt }
            }
          }
        : latest
    );
  }, []);

  return { state, loadingMore: more.loading, loadMoreError: more.error, loadMore, applySaved };
};
