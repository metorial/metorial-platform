import { useEffect, useMemo, useState } from 'react';

type PaginatedData<T> = {
  items: T[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

type LoaderResult<T> = {
  data: PaginatedData<T> | null;
  isLoading: boolean;
  error: any | null;
  refetch: () => void;
  mutators: Record<string, never>;
};

export let usePaginatedLoader = <T extends { id: string }, P>(
  loader: { use: (params: P | null) => LoaderResult<T> },
  params: Omit<P, 'after' | 'before'> | null
) => {
  let [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  let serializedParams = JSON.stringify(params ?? null);

  useEffect(() => {
    setCursor(currentCursor =>
      currentCursor.after || currentCursor.before ? {} : currentCursor
    );
  }, [serializedParams]);

  let result = loader.use(params ? ({ ...params, ...cursor } as P) : null);

  let transformedData = useMemo(() => {
    if (!result.data) return null;
    return {
      ...result.data,
      pagination: {
        hasMoreAfter: result.data.pagination.has_more_after,
        hasMoreBefore: result.data.pagination.has_more_before
      }
    };
  }, [result.data]);

  return {
    ...result,
    data: transformedData,
    next: () => {
      let items = result.data?.items;
      if (items?.length) {
        setCursor({ after: items[items.length - 1].id });
      }
    },
    previous: () => {
      let items = result.data?.items;
      if (items?.length) {
        setCursor({ before: items[0].id });
      }
    }
  };
};
