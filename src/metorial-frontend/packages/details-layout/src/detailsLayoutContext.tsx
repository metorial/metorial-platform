import React, { createContext, useContext } from 'react';
import type { DetailsLayoutAction } from './components/actions';
import type { DetailsBreadcrumb } from './components/breadcrumbs';
import type { DetailsTab } from './components/tabs';

export type DetailsLayoutEntity =
  | null
  | undefined
  | {
      id: string;
      slug?: string;
      name?: string | null;
      description?: string | null;
    };

export type DetailsLayoutAttribute = {
  label: React.ReactNode;
  value: React.ReactNode;
};

export type DetailsLayoutContextValue = {
  entity: DetailsLayoutEntity;
  icon?: React.ReactNode;
  breadcrumbs: DetailsBreadcrumb[];
  tabs?: DetailsTab[];
  actions?: DetailsLayoutAction[];
  attributes: DetailsLayoutAttribute[];
};

export let DetailsLayoutContext = createContext<DetailsLayoutContextValue | null>(null);

export let useDetailsLayout = () => {
  let context = useContext(DetailsLayoutContext);

  if (!context) {
    throw new Error('Details sub-layouts must be rendered inside DetailsLayout');
  }

  return context;
};

export let getDetailsLayoutEntityLabel = (entity: DetailsLayoutEntity) =>
  entity?.name || entity?.slug || entity?.id || '...............';
