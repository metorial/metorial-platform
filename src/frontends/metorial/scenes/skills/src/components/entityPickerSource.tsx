import {
  ResourceIcon,
  type AccessResourceKind,
  type PickerItem,
  type PickerSource
} from '@metorial/access-ui';
import { mergedSource, useMergedPaginator, type MergedLoader } from '@metorial/state';
import type React from 'react';
import { useState } from 'react';

let pageSize = 25;

type Entity = { id: string; name: string; imageUrl?: string | null };

export let useEntityPickerSource = <I, T extends Entity>(p: {
  loader: MergedLoader<I, T>;
  input: Omit<I, 'limit' | 'after' | 'before' | 'cursor' | 'order'>;
  kind: AccessResourceKind;
  exclude?: (item: T) => boolean;
  subtitle?: (item: T) => React.ReactNode;
  resetKey?: string;
}): PickerSource<T> => {
  let [attempt, setAttempt] = useState(0);

  let entities = useMergedPaginator({
    pageSize,
    order: 'asc',
    resetKey: `${p.resetKey ?? ''}:${attempt}`,
    sources: { items: mergedSource({ loader: p.loader, input: p.input }) },
    exclude: entry => !!p.exclude?.(entry.item as T)
  });

  let items = entities.rows.flatMap((row): PickerItem<T>[] => {
    if (row.type != 'item') return [];

    let entity = row.item as T;
    return [
      {
        key: entity.id,
        icon: size => (
          <ResourceIcon
            kind={p.kind}
            name={entity.name}
            imageUrl={entity.imageUrl}
            size={size}
          />
        ),
        title: entity.name,
        subtitle: p.subtitle?.(entity),
        value: entity
      }
    ];
  });

  return {
    items,
    isLoading: entities.isLoading,
    hasMore: entities.hasMore,
    loadMore: entities.loadMore,
    isLoadingMore: entities.isLoadingMore,
    error: entities.error,
    retry: () => setAttempt(current => current + 1)
  };
};
