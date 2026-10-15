import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  createUploadQueue,
  summarizeUploads,
  type UploadItem,
  type UploadQueueOptions,
  type UploadQueueSummary
} from './queue';

export interface UseUploadQueueOptions<M = unknown> extends UploadQueueOptions<M> {
  cancelOnUnmount?: boolean;
}

export interface UploadQueueHandle<M = unknown> {
  items: UploadItem<M>[];
  summary: UploadQueueSummary;
  add(files: Iterable<File> | ArrayLike<File>, meta?: M): string[];
  cancel(id: string): void;
  retry(id: string): void;
  remove(id: string): void;
  clear(): void;
  cancelAll(): void;
}

export let useUploadQueue = <M = unknown>(
  options: UseUploadQueueOptions<M>
): UploadQueueHandle<M> => {
  let optionsRef = useRef(options);
  optionsRef.current = options;

  let [queue] = useState(() => createUploadQueue<M>(() => optionsRef.current));
  let items = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);

  useEffect(
    () => () => {
      if (optionsRef.current.cancelOnUnmount !== false) queue.cancelAll();
    },
    [queue]
  );

  return useMemo(
    () => ({
      items,
      summary: summarizeUploads(items),
      add: queue.add,
      cancel: queue.cancel,
      retry: queue.retry,
      remove: queue.remove,
      clear: queue.clear,
      cancelAll: queue.cancelAll
    }),
    [items, queue]
  );
};
