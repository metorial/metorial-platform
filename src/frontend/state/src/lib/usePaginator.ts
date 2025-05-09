import { useRef, useState } from 'react';

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
  useHook: (opts: { before?: string; after?: string }) => T
) => {
  let [cursor, setCursor] = useState<{ before?: string; after?: string }>({});

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
