import { usePaginationSearchParamsEnabled } from '@metorial/data-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

let getCursorFromSearchParams = (searchParams: URLSearchParams) => {
  let before = searchParams.get('before') ?? undefined;
  let after = searchParams.get('after') ?? undefined;

  return {
    ...(before ? { before } : {}),
    ...(after ? { after } : {})
  };
};

let isSameCursor = (
  a: { before?: string; after?: string },
  b: { before?: string; after?: string }
) => {
  return a.before == b.before && a.after == b.after;
};

export let usePaginator = <
  T extends {
    data: {
      items: I[];
      pagination: {
        hasMoreAfter: boolean;
        hasMoreBefore: boolean;
      };
    } | null;
  },
  I extends { id: string }
>(
  useHook: (opts: { before?: string; after?: string }) => T,
  resetKey?: string | null
) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let paginationSearchParamsEnabled = usePaginationSearchParamsEnabled();
  let [cursor, setCursor] = useState<{ before?: string; after?: string }>(() => {
    if (!paginationSearchParamsEnabled) return {};
    return getCursorFromSearchParams(searchParams);
  });
  let didMountResetRef = useRef(false);
  let previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (!paginationSearchParamsEnabled) {
      setCursor(current => (current.before || current.after ? {} : current));
      return;
    }

    let nextCursor = getCursorFromSearchParams(searchParams);

    setCursor(current => (isSameCursor(current, nextCursor) ? current : nextCursor));
  }, [paginationSearchParamsEnabled, searchParams]);

  useEffect(() => {
    if (!paginationSearchParamsEnabled) return;

    if (!didMountResetRef.current) {
      didMountResetRef.current = true;
      previousResetKeyRef.current = resetKey;
      return;
    }

    if (previousResetKeyRef.current == resetKey) return;
    previousResetKeyRef.current = resetKey;

    setCursor(current => {
      if (!current.before && !current.after) return current;

      setSearchParams(
        currentSearchParams => {
          let nextSearchParams = new URLSearchParams(currentSearchParams);
          nextSearchParams.delete('before');
          nextSearchParams.delete('after');
          return nextSearchParams;
        },
        { replace: true }
      );

      return {};
    });
  }, [paginationSearchParamsEnabled, resetKey, setSearchParams]);

  let res = useHook(cursor);
  let dataRef = useRef(res.data);
  dataRef.current = res.data;

  return {
    ...res,
    next: () => {
      let lastItem = dataRef.current?.items[dataRef.current.items.length - 1];
      if (lastItem) setCursor({ after: lastItem.id });
    },
    previous: () => {
      let firstItem = dataRef.current?.items[0];
      if (firstItem) setCursor({ before: firstItem.id });
    }
  };
};
