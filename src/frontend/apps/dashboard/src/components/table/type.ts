import { ServiceError } from '@lowerdeck/error';
import { FilterPayload } from './filter';

export type TableColumn<Item extends { id: string }, Input extends {}> = {
  id: string;
  isDefault: boolean;
  header: React.ReactNode;
  render: (row: Item, input: Input) => React.ReactNode;
};

export type TableClickable<Item extends { id: string }, Input extends {}> = (
  row: Item,
  input: Input
) => void;

export type TableStateProvider<
  Props,
  Item extends { id: string },
  Result extends TableStateProviderResult<Item>
> = (props: Props, opts: { filter: Record<string, FilterPayload>; search?: string }) => Result;

export type TableStateProviderResult<Item extends { id: string }> = {
  isLoading: boolean;
  error?: ServiceError<any> | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  items: Item[];
  loadNext: () => void;
  loadPrevious: () => void;
};

export type TableAction<Item, HooksState> = (
  rows: Item[],
  state: HooksState
) => Promise<{
  items: {
    id: string;
    isDeleted?: boolean;
  }[];
} | void>;

export type TableActions<Item, HooksState> = {
  [key: string]: TableAction<Item, HooksState>;
};

export type TableItemAction<Item, Actions extends TableActions<any, any>> = {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: (row: Item) => boolean;
  action: keyof Actions;
  bulkExecution?: {
    mode: 'per-row';
    batchSize?: number;
  };
};
