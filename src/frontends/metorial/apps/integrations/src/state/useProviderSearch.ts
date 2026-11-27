import { useMemo, useState } from 'react';
import { providerSearchLoader } from './loaders';
import type { SessionCredentials } from './types';

type Cursor = { before?: string; after?: string };

export let useProviderSearch = (
  credentials: SessionCredentials,
  { search, limit }: { search?: string; limit: number }
) => {
  let resetKey = `${credentials.sessionId}:${search ?? ''}:${limit}`;
  let [cursor, setCursor] = useState<Cursor>({});
  let [cursorKey, setCursorKey] = useState(resetKey);

  if (cursorKey !== resetKey) {
    setCursorKey(resetKey);
    setCursor({});
  }

  let input = useMemo(
    () => ({ ...credentials, search, limit, ...cursor }),
    [credentials, search, limit, cursor]
  );

  let providers = providerSearchLoader.use(input);
  let items = providers.data?.items ?? [];

  return {
    ...providers,

    next: () => {
      let lastItem = items[items.length - 1];
      if (lastItem) setCursor({ after: lastItem.id });
    },

    previous: () => {
      let firstItem = items[0];
      if (firstItem) setCursor({ before: firstItem.id });
    }
  };
};
