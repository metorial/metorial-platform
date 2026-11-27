import type React from 'react';

export type PickerBack = { label: string; onBack: () => void };

export type PickerSettingsContext<V> = {
  set: (value: V) => void;
  close: () => void;
  setBack: (back: PickerBack | null) => void;
};

export type PickerSettings<V> = {
  initial: V;
  autoOpen?: boolean;
  isReady?: (value: V) => boolean;
  summary: (value: V) => React.ReactNode | null;
  needs: React.ReactNode;
  render: (value: V, ctx: PickerSettingsContext<V>) => React.ReactNode;
};

export type PickerItem<V = unknown> = {
  key: string;
  icon: (size: number) => React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  kind?: React.ReactNode;
  value?: V;
  settings?: PickerSettings<V>;
};

export type PickerSelection<V = unknown> = {
  item: PickerItem<V>;
  value: V;
};

export type PickerSource<V = unknown> = {
  items: PickerItem<V>[];
  isLoading: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
  isLoadingMore?: boolean;
  error?: unknown;
  retry?: () => void;
};

export type PickerSubmitResult = { failed: string[] } | void;
